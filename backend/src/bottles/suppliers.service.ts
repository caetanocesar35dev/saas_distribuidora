import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditContext } from '../audit/audit-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSupplierDto,
  ListSuppliersQuery,
  UpdateSupplierDto,
} from './dto/bottles.dto';

const SELECT = {
  id: true,
  companyId: true,
  name: true,
  createdAt: true,
  deletedAt: true,
};

/**
 * Fornecedores da empresa (decidido pelo usuário, 2026-11-24): só o nome, para anotar no envio e no
 * recebimento de cascos. Excluir só tira da escolha: as movimentações feitas continuam com ele.
 */
@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  list(companyId: string, query: ListSuppliersQuery = {}) {
    if (query.deleted) {
      return this.audit.withDeleted(() =>
        this.prisma.supplier.findMany({
          where: { companyId, deletedAt: { not: null } },
          select: SELECT,
          orderBy: { name: 'asc' },
        }),
      );
    }
    return this.prisma.supplier.findMany({
      where: { companyId },
      select: SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async get(companyId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId },
      select: SELECT,
    });
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');
    return supplier;
  }

  async create(companyId: string, dto: CreateSupplierDto) {
    await this.assertNameFree(companyId, dto.name);
    return this.prisma.supplier.create({
      data: { companyId, name: dto.name },
      select: SELECT,
    });
  }

  async update(companyId: string, id: string, dto: UpdateSupplierDto) {
    await this.get(companyId, id);
    if (dto.name) await this.assertNameFree(companyId, dto.name, id);
    return this.prisma.supplier.update({
      where: { id },
      data: { name: dto.name },
      select: SELECT,
    });
  }

  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Fornecedor excluído.' };
  }

  async restore(companyId: string, id: string) {
    const supplier = await this.audit.withDeleted(() =>
      this.prisma.supplier.findFirst({ where: { id, companyId } }),
    );
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');
    if (!supplier.deletedAt)
      throw new ConflictException('O fornecedor não está excluído.');

    await this.audit.withDeleted(() =>
      this.prisma.supplier.update({
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
      this.prisma.supplier.findFirst({
        where: { companyId, name },
        select: { id: true, deletedAt: true },
      }),
    );
    if (!existing || existing.id === exceptId) return;
    throw new ConflictException(
      existing.deletedAt
        ? `O fornecedor "${name}" existe, mas está excluído (id ${existing.id}). Reative-o em vez de cadastrar de novo.`
        : `Já existe um fornecedor chamado "${name}".`,
    );
  }
}
