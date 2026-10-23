import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidCnpj, normalizeCnpj } from '../common/utils/document';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/account.dto';

/** O CNPJ da loja é opcional; quando vem, é conferido e gravado sem máscara, em maiúsculas. */
function withValidCnpj<T extends { cnpj?: string }>(dto: T): T {
  if (dto.cnpj === undefined) return dto;
  const cnpj = normalizeCnpj(dto.cnpj);
  if (!isValidCnpj(cnpj)) throw new BadRequestException('CNPJ inválido.');
  return { ...dto, cnpj };
}

const STORE_SELECT = {
  id: true,
  companyId: true,
  name: true,
  cnpj: true,
  phone: true,
  zipCode: true,
  street: true,
  number: true,
  complement: true,
  neighborhood: true,
  city: true,
  state: true,
  createdAt: true,
} as const;

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.store.findMany({
      where: { companyId },
      select: STORE_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async get(companyId: string, id: string) {
    const store = await this.prisma.store.findFirst({
      where: { id, companyId },
      select: STORE_SELECT,
    });
    if (!store) throw new NotFoundException('Loja não encontrada.');
    return store;
  }

  /**
   * Cria a loja respeitando o limite do plano e dá OWNER nela a todos os donos da empresa
   * (quem já é OWNER em alguma loja).
   */
  async create(companyId: string, input: CreateStoreDto) {
    const dto = withValidCnpj(input);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: {
        organization: {
          select: { plan: { select: { maxStoresPerCompany: true } } },
        },
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'company-stores:' + companyId}))`;

      const max = company.organization.plan.maxStoresPerCompany;
      if (
        max !== null &&
        (await tx.store.count({ where: { companyId } })) >= max
      ) {
        throw new ConflictException(
          `O plano permite no máximo ${max} loja(s) por empresa.`,
        );
      }

      const store = await tx.store.create({ data: { ...dto, companyId } });

      const owners = await tx.membershipStore.findMany({
        where: {
          role: 'OWNER',
          store: { deletedAt: null, companyId },
          membership: { deletedAt: null, companyId },
        },
        select: { membershipId: true },
        distinct: ['membershipId'],
      });
      if (owners.length > 0) {
        await tx.membershipStore.createMany({
          data: owners.map((o) => ({
            membershipId: o.membershipId,
            storeId: store.id,
            role: 'OWNER' as const,
          })),
        });
      }
      return store;
    });
  }

  async update(companyId: string, id: string, input: UpdateStoreDto) {
    const dto = withValidCnpj(input);
    await this.get(companyId, id);
    return this.prisma.store.update({
      where: { id },
      data: dto,
      select: STORE_SELECT,
    });
  }

  /** Exclusão (soft delete): bloqueada com caixa aberto ou comanda aberta. */
  async remove(companyId: string, id: string) {
    await this.get(companyId, id);

    const [openCash, openTabs] = await Promise.all([
      this.prisma.cashRegister.count({
        where: { storeId: id, status: 'OPEN' },
      }),
      this.prisma.commandTab.count({ where: { storeId: id, status: 'OPEN' } }),
    ]);
    if (openCash > 0)
      throw new ConflictException('Feche o caixa da loja antes de excluí-la.');
    if (openTabs > 0)
      throw new ConflictException('Existem comandas abertas nesta loja.');

    await this.prisma.store.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Loja excluída.' };
  }
}
