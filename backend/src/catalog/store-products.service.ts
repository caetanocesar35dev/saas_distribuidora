import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuditContext } from '../audit/audit-context';
import { paginate, pageArgs } from '../common/dto/pagination.dto';
import { roundMoney } from '../common/utils/money';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddStoreProductDto,
  ListStoreProductsQuery,
  StockAdjustmentDto,
  UpdateStoreProductDto,
} from './dto/catalog.dto';

const SELECT = {
  id: true,
  storeId: true,
  productId: true,
  price: true,
  costPrice: true,
  stock: true,
  isActive: true,
  product: {
    select: {
      code: true,
      name: true,
      packQuantity: true,
      bottleTypeId: true,
      bottleType: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.StoreProductSelect;

@Injectable()
export class StoreProductsService {
  private readonly logger = new Logger(StoreProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Listagem para o PDV e o estoque: oferta da loja + dados do produto. */
  async list(storeId: string, query: ListStoreProductsQuery) {
    const where: Prisma.StoreProductWhereInput = {
      storeId,
      product: {
        deletedAt: null,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search } },
              ],
            }
          : {}),
      },
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [data, total] = await Promise.all([
      this.prisma.storeProduct.findMany({
        where,
        select: SELECT,
        orderBy: { product: { name: 'asc' } },
        ...pageArgs(query),
      }),
      this.prisma.storeProduct.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async get(storeId: string, id: string) {
    const item = await this.prisma.storeProduct.findFirst({
      where: { id, storeId, product: { deletedAt: null } },
      select: SELECT,
    });
    if (!item)
      throw new NotFoundException('Produto não encontrado nesta loja.');
    return item;
  }

  /** Busca exata por código de barras (leitor do PDV). Só devolve itens ativos. */
  async getByCode(storeId: string, code: string) {
    const item = await this.prisma.storeProduct.findFirst({
      where: { storeId, isActive: true, product: { code, deletedAt: null } },
      select: SELECT,
    });
    if (!item)
      throw new NotFoundException(
        `Nenhum produto ativo com o código ${code} nesta loja.`,
      );
    return item;
  }

  /** Coloca à venda na loja um produto que já existe no catálogo (ou reativa a oferta excluída). */
  async add(storeId: string, companyId: string, dto: AddStoreProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, companyId },
    });
    if (!product)
      throw new NotFoundException('Produto não encontrado na empresa.');

    const existing = await this.audit.withDeleted(() =>
      this.prisma.storeProduct.findUnique({
        where: { storeId_productId: { storeId, productId: dto.productId } },
      }),
    );
    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        'Este produto já está cadastrado nesta loja.',
      );
    }

    const data = {
      price: roundMoney(dto.price),
      costPrice: roundMoney(dto.costPrice ?? 0),
      stock: dto.stock ?? 0,
      isActive: true,
    };
    const saved = existing
      ? await this.audit.withDeleted(() =>
          this.prisma.storeProduct.update({
            where: { id: existing.id },
            data: { ...data, deletedAt: null },
          }),
        )
      : await this.prisma.storeProduct.create({
          data: { storeId, productId: dto.productId, ...data },
        });
    return this.get(storeId, saved.id);
  }

  /** Preço, custo e situação. O estoque só muda por entrada, ajuste ou venda. */
  async update(storeId: string, id: string, dto: UpdateStoreProductDto) {
    await this.get(storeId, id);
    await this.prisma.storeProduct.update({
      where: { id },
      data: {
        price: dto.price === undefined ? undefined : roundMoney(dto.price),
        costPrice:
          dto.costPrice === undefined ? undefined : roundMoney(dto.costPrice),
        isActive: dto.isActive,
      },
    });
    return this.get(storeId, id);
  }

  /** Entrada de mercadoria: incremento atômico. */
  async stockEntry(storeId: string, id: string, quantity: number) {
    const result = await this.prisma.storeProduct.updateMany({
      where: { id, storeId },
      data: { stock: { increment: quantity } },
    });
    if (result.count === 0)
      throw new NotFoundException('Produto não encontrado nesta loja.');
    return this.get(storeId, id);
  }

  /** Ajuste de inventário: define o estoque contado. O motivo vai para o log (sem coluna própria). */
  async stockAdjustment(storeId: string, id: string, dto: StockAdjustmentDto) {
    const before = await this.get(storeId, id);
    await this.prisma.storeProduct.updateMany({
      where: { id, storeId },
      data: { stock: dto.newStock },
    });
    // TODO(decisão-produto): o motivo do ajuste não tem coluna no schema, então fica só no log.
    // Guardá-lo no banco exigiria mudar o schema (parada P9).
    this.logger.log(
      `Ajuste de inventário loja=${storeId} item=${id}: ${before.stock} -> ${dto.newStock}. Motivo: ${dto.reason}`,
    );
    return this.get(storeId, id);
  }

  async lowStock(storeId: string, threshold?: number) {
    const limit =
      threshold ?? this.config.get('LOW_STOCK_THRESHOLD', { infer: true });
    return this.prisma.storeProduct.findMany({
      where: {
        storeId,
        isActive: true,
        stock: { lte: limit },
        product: { deletedAt: null },
      },
      select: SELECT,
      orderBy: [{ stock: 'asc' }, { product: { name: 'asc' } }],
    });
  }

  /** Tira o produto da loja (soft delete). Para só suspender a venda, use isActive=false. */
  async remove(storeId: string, id: string) {
    await this.get(storeId, id);
    await this.prisma.storeProduct.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { message: 'Produto removido da loja.' };
  }
}
