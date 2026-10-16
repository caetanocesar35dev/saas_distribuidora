import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditContext } from '../audit/audit-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBottleTypeDto, UpdateBottleTypeDto } from './dto/catalog.dto';

@Injectable()
export class BottleTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  list(companyId: string) {
    return this.prisma.bottleType.findMany({
      where: { companyId },
      select: { id: true, companyId: true, name: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async get(companyId: string, id: string) {
    const bottleType = await this.prisma.bottleType.findFirst({
      where: { id, companyId },
      select: { id: true, companyId: true, name: true, createdAt: true },
    });
    if (!bottleType)
      throw new NotFoundException('Tipo de vasilhame não encontrado.');
    return bottleType;
  }

  async create(companyId: string, dto: CreateBottleTypeDto) {
    await this.assertNameFree(companyId, dto.name);
    return this.prisma.bottleType.create({
      data: { companyId, name: dto.name },
      select: { id: true, companyId: true, name: true, createdAt: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateBottleTypeDto) {
    await this.get(companyId, id);
    if (dto.name) await this.assertNameFree(companyId, dto.name, id);
    return this.prisma.bottleType.update({
      where: { id },
      data: { name: dto.name },
      select: { id: true, companyId: true, name: true, createdAt: true },
    });
  }

  /** Bloqueado se algum cliente deve esse vasilhame ou se algum produto ainda o usa. */
  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    const [debts, products] = await Promise.all([
      this.prisma.customerStoreBottleBalance.count({
        where: { bottleTypeId: id, balance: { not: 0 } },
      }),
      this.prisma.product.count({ where: { bottleTypeId: id } }),
    ]);
    if (debts > 0)
      throw new ConflictException(
        'Existem clientes com saldo deste vasilhame.',
      );
    if (products > 0)
      throw new ConflictException(
        'Existem produtos usando este tipo de vasilhame.',
      );

    await this.prisma.bottleType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Tipo de vasilhame excluído.' };
  }

  async restore(companyId: string, id: string) {
    const bottleType = await this.audit.withDeleted(() =>
      this.prisma.bottleType.findFirst({ where: { id, companyId } }),
    );
    if (!bottleType)
      throw new NotFoundException('Tipo de vasilhame não encontrado.');
    if (!bottleType.deletedAt)
      throw new ConflictException('O tipo de vasilhame não está excluído.');

    await this.audit.withDeleted(() =>
      this.prisma.bottleType.update({
        where: { id },
        data: { deletedAt: null },
      }),
    );
    return this.get(companyId, id);
  }

  /** O nome é único por empresa, inclusive entre os excluídos. */
  private async assertNameFree(
    companyId: string,
    name: string,
    exceptId?: string,
  ) {
    const existing = await this.audit.withDeleted(() =>
      this.prisma.bottleType.findFirst({
        where: { companyId, name },
        select: { id: true, deletedAt: true },
      }),
    );
    if (!existing || existing.id === exceptId) return;
    throw new ConflictException(
      existing.deletedAt
        ? `O tipo "${name}" existe, mas está excluído (id ${existing.id}). Reative-o em vez de cadastrar de novo.`
        : `Já existe um tipo de vasilhame chamado "${name}".`,
    );
  }
}
