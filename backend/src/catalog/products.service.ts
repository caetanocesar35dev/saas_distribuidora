import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditContext } from '../audit/audit-context';
import { paginate, pageArgs } from '../common/dto/pagination.dto';
import { generateEan13 } from '../common/utils/ean13';
import { roundMoney } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  ListProductsQuery,
  UpdateProductDto,
} from './dto/catalog.dto';

const PRODUCT_SELECT = {
  id: true,
  companyId: true,
  code: true,
  name: true,
  packQuantity: true,
  bottleTypeId: true,
  bottleType: { select: { id: true, name: true } },
  createdAt: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  async list(companyId: string, query: ListProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      companyId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search } },
            ],
          }
        : {}),
    };
    const read = () =>
      Promise.all([
        this.prisma.product.findMany({
          where,
          select: { ...PRODUCT_SELECT, deletedAt: true },
          orderBy: { name: 'asc' },
          ...pageArgs(query),
        }),
        this.prisma.product.count({ where }),
      ]);
    // Excluídos: a extensão esconde quem tem deletedAt, então a leitura sai do filtro padrão.
    if (query.deleted) where.deletedAt = { not: null };
    const [data, total] = query.deleted
      ? await this.audit.withDeleted(read)
      : await read();
    return paginate(data, total, query.page, query.limit);
  }

  async get(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      select: {
        ...PRODUCT_SELECT,
        storeProducts: {
          where: { deletedAt: null, store: { deletedAt: null } },
          select: {
            id: true,
            storeId: true,
            price: true,
            costPrice: true,
            stock: true,
            isActive: true,
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  async create(companyId: string, dto: CreateProductDto) {
    if (dto.bottleTypeId)
      await this.assertBottleType(companyId, dto.bottleTypeId);

    const offers = dto.stores ?? [];
    const storeIds = offers.map((o) => o.storeId);
    if (new Set(storeIds).size !== storeIds.length) {
      throw new BadRequestException('Cada loja só pode aparecer uma vez.');
    }
    if (storeIds.length > 0) {
      const valid = await this.prisma.store.count({
        where: { companyId, id: { in: storeIds } },
      });
      if (valid !== storeIds.length)
        throw new BadRequestException('Alguma loja não pertence à empresa.');
    }

    const code = dto.code ?? (await this.generateUniqueCode(companyId));
    if (dto.code) await this.assertCodeFree(companyId, code);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          companyId,
          code,
          name: dto.name,
          packQuantity: dto.packQuantity ?? 1,
          bottleTypeId: dto.bottleTypeId,
        },
        select: PRODUCT_SELECT,
      });
      if (offers.length > 0) {
        await tx.storeProduct.createMany({
          data: offers.map((o) => ({
            storeId: o.storeId,
            productId: product.id,
            price: roundMoney(o.price),
            costPrice: roundMoney(o.costPrice ?? dto.costPrice ?? 0),
          })),
        });
      }
      return product;
    });
  }

  async update(companyId: string, id: string, dto: UpdateProductDto) {
    await this.get(companyId, id);
    if (dto.bottleTypeId)
      await this.assertBottleType(companyId, dto.bottleTypeId);
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        packQuantity: dto.packQuantity,
        bottleTypeId: dto.bottleTypeId,
      },
      select: PRODUCT_SELECT,
    });
  }

  /** Exclui o produto (soft delete) e as ofertas dele nas lojas. */
  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.storeProduct.updateMany({
        where: { productId: id },
        data: { deletedAt: now },
      });
      await tx.product.update({ where: { id }, data: { deletedAt: now } });
    });
    return { message: 'Produto excluído.' };
  }

  /**
   * Reativa um produto excluído (o código dele continua reservado). As ofertas que saíram junto
   * com ele (mesmo `deletedAt`) voltam com o preço e o estoque de antes, nas lojas ativas.
   */
  async restore(companyId: string, id: string) {
    const product = await this.audit.withDeleted(() =>
      this.prisma.product.findFirst({ where: { id, companyId } }),
    );
    if (!product) throw new NotFoundException('Produto não encontrado.');
    if (!product.deletedAt)
      throw new ConflictException('O produto não está excluído.');
    const deletedAt = product.deletedAt;

    await this.audit.withDeleted(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.storeProduct.updateMany({
          where: {
            productId: id,
            deletedAt,
            store: { deletedAt: null },
          },
          data: { deletedAt: null },
        });
        await tx.product.update({ where: { id }, data: { deletedAt: null } });
      }),
    );
    return this.get(companyId, id);
  }

  private async assertBottleType(companyId: string, bottleTypeId: string) {
    const bottleType = await this.prisma.bottleType.findFirst({
      where: { id: bottleTypeId, companyId },
    });
    if (!bottleType)
      throw new BadRequestException(
        'Tipo de vasilhame não encontrado nesta empresa.',
      );
  }

  /** O código é único por empresa, inclusive entre os excluídos. */
  private async assertCodeFree(companyId: string, code: string) {
    const existing = await this.audit.withDeleted(() =>
      this.prisma.product.findFirst({
        where: { companyId, code },
        select: { id: true, deletedAt: true },
      }),
    );
    if (!existing) return;
    throw new ConflictException(
      existing.deletedAt
        ? `O código ${code} pertence a um produto excluído (id ${existing.id}). Reative-o em vez de cadastrar de novo.`
        : `Já existe um produto com o código ${code}.`,
    );
  }

  private async generateUniqueCode(companyId: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateEan13();
      const exists = await this.audit.withDeleted(() =>
        this.prisma.product.findFirst({
          where: { companyId, code },
          select: { id: true },
        }),
      );
      if (!exists) return code;
    }
    throw new ConflictException(
      'Não foi possível gerar um código de barras único. Tente novamente.',
    );
  }
}
