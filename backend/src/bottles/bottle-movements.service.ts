import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, pageArgs } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  addCustomerBottleBalance,
  addStoreBottleStock,
  recordBottleMovement,
  returnCustomerBottles,
} from './bottle-ledger';
import {
  CustomerBottleDto,
  ListBottleMovementsQuery,
  ManualBottleMovementDto,
} from './dto/bottles.dto';

const MOVEMENT_SELECT = {
  id: true,
  storeId: true,
  bottleTypeId: true,
  bottleType: { select: { id: true, name: true } },
  quantity: true,
  type: true,
  description: true,
  customerId: true,
  customer: { select: { id: true, name: true } },
  saleId: true,
  createdAt: true,
} satisfies Prisma.BottleMovementSelect;

@Injectable()
export class BottleMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Movimentação manual da loja (envio/recebimento do fornecedor e ajuste). A quantidade é gravada
   * COM SINAL: positivo entra na loja, negativo sai. O estoque nunca pode ficar negativo aqui.
   */
  async registerManual(
    storeId: string,
    companyId: string,
    dto: ManualBottleMovementDto,
  ) {
    if (dto.type !== 'MANUAL_ADJUSTMENT' && dto.quantity < 0) {
      throw new BadRequestException(
        'Informe a quantidade como número positivo.',
      );
    }
    await this.assertBottleType(companyId, dto.bottleTypeId);

    const signed = dto.type === 'SUPPLIER_SEND' ? -dto.quantity : dto.quantity;

    return this.prisma.$transaction(async (tx) => {
      await addStoreBottleStock(tx, storeId, dto.bottleTypeId, signed, false);
      const movement = await recordBottleMovement(tx, {
        storeId,
        bottleTypeId: dto.bottleTypeId,
        quantity: signed,
        type: dto.type,
        description: dto.description,
      });
      return tx.bottleMovement.findUniqueOrThrow({
        where: { id: movement.id },
        select: MOVEMENT_SELECT,
      });
    });
  }

  /**
   * Empréstimo avulso (fora de venda): o cliente leva vasilhames da loja. O estoque da loja não
   * pode ficar negativo.
   */
  async customerBorrow(
    storeId: string,
    companyId: string,
    customerId: string,
    dto: CustomerBottleDto,
  ) {
    await this.assertBottleType(companyId, dto.bottleTypeId);
    await this.assertCustomer(companyId, customerId);

    return this.prisma.$transaction(async (tx) => {
      await addStoreBottleStock(
        tx,
        storeId,
        dto.bottleTypeId,
        -dto.quantity,
        false,
      );
      await addCustomerBottleBalance(
        tx,
        customerId,
        storeId,
        dto.bottleTypeId,
        dto.quantity,
      );
      const movement = await recordBottleMovement(tx, {
        storeId,
        bottleTypeId: dto.bottleTypeId,
        quantity: -dto.quantity,
        type: 'CUSTOMER_BORROW',
        customerId,
        description: dto.description ?? 'Empréstimo de vasilhame',
      });
      return tx.bottleMovement.findUniqueOrThrow({
        where: { id: movement.id },
        select: MOVEMENT_SELECT,
      });
    });
  }

  /**
   * Devolução do cliente. Regra do produto: só abate a dívida da PRÓPRIA loja (o movimento só
   * registra uma loja), e nunca mais do que o cliente deve nela.
   */
  async customerReturn(
    storeId: string,
    companyId: string,
    customerId: string,
    dto: CustomerBottleDto,
  ) {
    await this.assertBottleType(companyId, dto.bottleTypeId);
    await this.assertCustomer(companyId, customerId);

    return this.prisma.$transaction(async (tx) => {
      await returnCustomerBottles(
        tx,
        customerId,
        storeId,
        dto.bottleTypeId,
        dto.quantity,
      );
      await addStoreBottleStock(
        tx,
        storeId,
        dto.bottleTypeId,
        dto.quantity,
        true,
      );
      const movement = await recordBottleMovement(tx, {
        storeId,
        bottleTypeId: dto.bottleTypeId,
        quantity: dto.quantity,
        type: 'CUSTOMER_RETURN',
        customerId,
        description: dto.description ?? 'Devolução de vasilhame',
      });
      return tx.bottleMovement.findUniqueOrThrow({
        where: { id: movement.id },
        select: MOVEMENT_SELECT,
      });
    });
  }

  async list(storeId: string, query: ListBottleMovementsQuery) {
    const where: Prisma.BottleMovementWhereInput = {
      storeId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.bottleTypeId ? { bottleTypeId: query.bottleTypeId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.bottleMovement.findMany({
        where,
        select: MOVEMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.bottleMovement.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  /** Estoque de cada tipo de vasilhame da empresa nesta loja (0 para os que nunca movimentaram). */
  async stock(storeId: string, companyId: string) {
    const types = await this.prisma.bottleType.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        storeStocks: {
          where: { storeId, deletedAt: null },
          select: { stock: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return types.map((t) => ({
      bottleTypeId: t.id,
      bottleTypeName: t.name,
      stock: t.storeStocks[0]?.stock ?? 0,
    }));
  }

  private async assertBottleType(companyId: string, bottleTypeId: string) {
    const bottleType = await this.prisma.bottleType.findFirst({
      where: { id: bottleTypeId, companyId },
    });
    if (!bottleType)
      throw new NotFoundException(
        'Tipo de vasilhame não encontrado nesta empresa.',
      );
  }

  private async assertCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer)
      throw new NotFoundException('Cliente não encontrado nesta empresa.');
  }
}
