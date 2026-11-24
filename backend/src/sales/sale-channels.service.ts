import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditContext } from '../audit/audit-context';
import { PrismaTx } from '../prisma/prisma.extension';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSaleChannelDto,
  ListSaleChannelsQuery,
  UpdateSaleChannelDto,
} from './dto/sales.dto';
import { DEFAULT_SALE_CHANNELS } from './sale-channels';

const SELECT = {
  id: true,
  companyId: true,
  name: true,
  isDefault: true,
  createdAt: true,
  deletedAt: true,
};

/**
 * Origens da venda da empresa (balcão, iFood...): criar, renomear, excluir, reativar e escolher a
 * padrão. Excluir só tira da escolha: as vendas feitas continuam com a origem.
 */
@Injectable()
export class SaleChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  list(companyId: string, query: ListSaleChannelsQuery = {}) {
    if (query.deleted) {
      return this.audit.withDeleted(() =>
        this.prisma.saleChannel.findMany({
          where: { companyId, deletedAt: { not: null } },
          select: SELECT,
          orderBy: { name: 'asc' },
        }),
      );
    }
    // A padrão primeiro: é a que o PDV já deixa marcada.
    return this.prisma.saleChannel.findMany({
      where: { companyId },
      select: SELECT,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async get(companyId: string, id: string) {
    const channel = await this.prisma.saleChannel.findFirst({
      where: { id, companyId },
      select: SELECT,
    });
    if (!channel) throw new NotFoundException('Origem não encontrada.');
    return channel;
  }

  async create(companyId: string, dto: CreateSaleChannelDto) {
    await this.assertNameFree(companyId, dto.name);
    return this.prisma.saleChannel.create({
      data: { companyId, name: dto.name },
      select: SELECT,
    });
  }

  async update(companyId: string, id: string, dto: UpdateSaleChannelDto) {
    await this.get(companyId, id);
    if (dto.name) await this.assertNameFree(companyId, dto.name, id);
    return this.prisma.saleChannel.update({
      where: { id },
      data: { name: dto.name },
      select: SELECT,
    });
  }

  /** Passa a ser a origem que o PDV já deixa marcada (só uma por empresa). */
  async setDefault(companyId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.$transaction(async (tx) => {
      // Duas trocas ao mesmo tempo não podem deixar duas padrões.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'sale-channels:' + companyId}))`;
      await tx.saleChannel.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      await tx.saleChannel.update({
        where: { id },
        data: { isDefault: true },
      });
    });
    return this.get(companyId, id);
  }

  /** A padrão não sai: escolha outra como padrão antes. */
  async remove(companyId: string, id: string) {
    const channel = await this.get(companyId, id);
    if (channel.isDefault)
      throw new ConflictException(
        'Esta é a origem padrão da venda. Escolha outra como padrão antes de excluir.',
      );
    await this.prisma.saleChannel.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Origem excluída.' };
  }

  async restore(companyId: string, id: string) {
    const channel = await this.audit.withDeleted(() =>
      this.prisma.saleChannel.findFirst({ where: { id, companyId } }),
    );
    if (!channel) throw new NotFoundException('Origem não encontrada.');
    if (!channel.deletedAt)
      throw new ConflictException('A origem não está excluída.');

    await this.audit.withDeleted(() =>
      this.prisma.saleChannel.update({
        where: { id },
        data: { deletedAt: null },
      }),
    );
    return this.get(companyId, id);
  }

  /** O nome é único por empresa, inclusive entre as excluídas. */
  private async assertNameFree(
    companyId: string,
    name: string,
    exceptId?: string,
  ) {
    const existing = await this.audit.withDeleted(() =>
      this.prisma.saleChannel.findFirst({
        where: { companyId, name },
        select: { id: true, deletedAt: true },
      }),
    );
    if (!existing || existing.id === exceptId) return;
    throw new ConflictException(
      existing.deletedAt
        ? `A origem "${name}" existe, mas está excluída (id ${existing.id}). Reative-a em vez de cadastrar de novo.`
        : `Já existe uma origem chamada "${name}".`,
    );
  }
}

/**
 * Origem de uma venda nova: a escolhida (precisa ser desta empresa e não estar excluída) ou, sem
 * escolha, a padrão da empresa. null só quando a empresa não tem nenhuma origem.
 */
/**
 * Origem da venda de uma comanda (decidido pelo usuário, 2026-11-24): comanda é consumo no balcão,
 * então a tela não pergunta a origem. Vale a origem chamada "Balcão" (sem diferenciar maiúsculas)
 * e, se a empresa a excluiu ou renomeou, a padrão.
 */
export async function resolveCounterChannel(
  tx: PrismaTx,
  companyId: string,
): Promise<string | null> {
  const counter = await tx.saleChannel.findFirst({
    where: {
      companyId,
      name: { equals: DEFAULT_SALE_CHANNELS[0], mode: 'insensitive' },
    },
    select: { id: true },
  });
  return counter?.id ?? resolveSaleChannel(tx, companyId);
}

export async function resolveSaleChannel(
  tx: PrismaTx,
  companyId: string,
  channelId?: string,
): Promise<string | null> {
  if (channelId) {
    const channel = await tx.saleChannel.findFirst({
      where: { id: channelId, companyId },
      select: { id: true },
    });
    if (!channel)
      throw new NotFoundException('Origem da venda não encontrada.');
    return channel.id;
  }
  const fallback = await tx.saleChannel.findFirst({
    where: { companyId, isDefault: true },
    select: { id: true },
  });
  return fallback?.id ?? null;
}
