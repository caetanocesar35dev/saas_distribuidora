import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditContext } from '../audit/audit-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductCategoryDto,
  ListProductCategoriesQuery,
  UpdateProductCategoryDto,
} from './dto/catalog.dto';

const SELECT = {
  id: true,
  companyId: true,
  name: true,
  createdAt: true,
  deletedAt: true,
};

@Injectable()
export class ProductCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  list(companyId: string, query: ListProductCategoriesQuery = {}) {
    if (query.deleted) {
      return this.audit.withDeleted(() =>
        this.prisma.productCategory.findMany({
          where: { companyId, deletedAt: { not: null } },
          select: SELECT,
          orderBy: { name: 'asc' },
        }),
      );
    }
    return this.prisma.productCategory.findMany({
      where: { companyId },
      select: SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async get(companyId: string, id: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, companyId },
      select: SELECT,
    });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    return category;
  }

  async create(companyId: string, dto: CreateProductCategoryDto) {
    await this.assertNameFree(companyId, dto.name);
    return this.prisma.productCategory.create({
      data: { companyId, name: dto.name },
      select: SELECT,
    });
  }

  async update(companyId: string, id: string, dto: UpdateProductCategoryDto) {
    await this.get(companyId, id);
    if (dto.name) await this.assertNameFree(companyId, dto.name, id);
    return this.prisma.productCategory.update({
      where: { id },
      data: { name: dto.name },
      select: SELECT,
    });
  }

  /** Bloqueado enquanto algum produto usa a categoria. */
  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    const products = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (products > 0)
      throw new ConflictException(
        'Existem produtos nesta categoria. Mude a categoria deles antes de excluir.',
      );

    await this.prisma.productCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Categoria excluída.' };
  }

  async restore(companyId: string, id: string) {
    const category = await this.audit.withDeleted(() =>
      this.prisma.productCategory.findFirst({ where: { id, companyId } }),
    );
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    if (!category.deletedAt)
      throw new ConflictException('A categoria não está excluída.');

    await this.audit.withDeleted(() =>
      this.prisma.productCategory.update({
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
      this.prisma.productCategory.findFirst({
        where: { companyId, name },
        select: { id: true, deletedAt: true },
      }),
    );
    if (!existing || existing.id === exceptId) return;
    throw new ConflictException(
      existing.deletedAt
        ? `A categoria "${name}" existe, mas está excluída (id ${existing.id}). Reative-a em vez de cadastrar de novo.`
        : `Já existe uma categoria chamada "${name}".`,
    );
  }
}
