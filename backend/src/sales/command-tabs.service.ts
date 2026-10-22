import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuditContext } from '../audit/audit-context';
import { roundMoney, toCents, fromCents } from '../common/utils/money';
import { PrismaTx } from '../prisma/prisma.extension';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddCommandItemDto,
  CloseCommandTabDto,
  CreateCommandTabDto,
} from './dto/sales.dto';
import { SalesService } from './sales.service';

const ITEM_SELECT = {
  id: true,
  storeProductId: true,
  quantity: true,
  price: true,
  costPrice: true,
  addedAt: true,
  storeProduct: { select: { product: { select: { code: true, name: true } } } },
} satisfies Prisma.CommandItemSelect;

const TAB_SELECT = {
  id: true,
  storeId: true,
  name: true,
  status: true,
  createdAt: true,
  customerId: true,
  customer: { select: { id: true, name: true } },
  items: {
    where: { deletedAt: null },
    select: ITEM_SELECT,
    orderBy: { addedAt: 'asc' },
  },
} satisfies Prisma.CommandTabSelect;

type TabRow = Prisma.CommandTabGetPayload<{ select: typeof TAB_SELECT }>;

function withTotal(tab: TabRow) {
  const cents = tab.items.reduce(
    (sum, i) => sum + toCents(roundMoney(i.price * i.quantity)),
    0,
  );
  return { ...tab, total: fromCents(cents) };
}

@Injectable()
export class CommandTabsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
    private readonly sales: SalesService,
  ) {}

  async create(storeId: string, companyId: string, dto: CreateCommandTabDto) {
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, companyId },
      });
      if (!customer)
        throw new NotFoundException('Cliente não encontrado nesta empresa.');
    }
    const tab = await this.prisma.commandTab.create({
      data: { storeId, name: dto.name, customerId: dto.customerId },
      select: TAB_SELECT,
    });
    return withTotal(tab);
  }

  /** Por padrão só as comandas abertas. */
  async list(storeId: string, status: 'OPEN' | 'CLOSED' = 'OPEN') {
    const tabs = await this.prisma.commandTab.findMany({
      where: { storeId, status },
      select: TAB_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return tabs.map(withTotal);
  }

  async get(storeId: string, id: string) {
    const tab = await this.prisma.commandTab.findFirst({
      where: { id, storeId },
      select: TAB_SELECT,
    });
    if (!tab) throw new NotFoundException('Comanda não encontrada.');
    return withTotal(tab);
  }

  /** O produto sai fisicamente da loja ao ser adicionado, então o estoque baixa agora. */
  async addItem(storeId: string, tabId: string, dto: AddCommandItemDto) {
    const itemId = await this.prisma.$transaction(async (tx) => {
      await this.lockOpenTab(tx, storeId, tabId);

      const product = await tx.storeProduct.findFirst({
        where: {
          id: dto.storeProductId,
          storeId,
          isActive: true,
          product: { deletedAt: null },
        },
        select: {
          id: true,
          price: true,
          costPrice: true,
          stock: true,
          product: { select: { name: true } },
        },
      });
      if (!product)
        throw new NotFoundException(
          'Produto não encontrado, inativo ou de outra loja.',
        );

      const decremented = await tx.storeProduct.updateMany({
        where: { id: product.id, storeId, stock: { gte: dto.quantity } },
        data: { stock: { decrement: dto.quantity } },
      });
      if (decremented.count === 0) {
        throw new ConflictException(
          `Estoque insuficiente para o produto "${product.product.name}". Disponível: ${product.stock}, solicitado: ${dto.quantity}.`,
        );
      }

      const item = await tx.commandItem.create({
        data: {
          commandTabId: tabId,
          storeProductId: product.id,
          quantity: dto.quantity,
          price: product.price,
          costPrice: product.costPrice,
        },
      });
      return item.id;
    });
    return this.prisma.commandItem.findUniqueOrThrow({
      where: { id: itemId },
      select: ITEM_SELECT,
    });
  }

  /** Remove o item (soft delete) e devolve o estoque. */
  async removeItem(storeId: string, tabId: string, itemId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOpenTab(tx, storeId, tabId);
      const item = await tx.commandItem.findFirst({
        where: { id: itemId, commandTabId: tabId },
      });
      if (!item)
        throw new NotFoundException('Item não encontrado nesta comanda.');

      await tx.commandItem.update({
        where: { id: itemId },
        data: { deletedAt: new Date() },
      });
      await this.returnStock(
        tx,
        storeId,
        new Map([[item.storeProductId, item.quantity]]),
      );
    });
    return { message: 'Item removido.' };
  }

  /**
   * Fecha a comanda gerando a venda pela mesma função da venda comum, com os preços do momento em
   * que cada item foi adicionado e SEM baixar o estoque de novo.
   */
  async close(
    storeId: string,
    companyId: string,
    userId: string,
    tabId: string,
    dto: CloseCommandTabDto,
    role: Role,
  ) {
    const saleId = await this.prisma.$transaction(async (tx) => {
      const tab = await this.lockOpenTab(tx, storeId, tabId);
      const items = await tx.commandItem.findMany({
        where: { commandTabId: tabId },
      });
      if (items.length === 0)
        throw new BadRequestException(
          'Não é possível fechar uma comanda vazia.',
        );

      await tx.commandTab.updateMany({
        where: { id: tabId, storeId, status: 'OPEN' },
        data: { status: 'CLOSED' },
      });

      return this.sales.createInTx(tx, {
        storeId,
        companyId,
        userId,
        paymentMethod: dto.paymentMethod,
        customerId: dto.customerId ?? tab.customerId,
        discount: dto.discount,
        lines: items.map((i) => ({
          storeProductId: i.storeProductId,
          quantity: i.quantity,
          price: i.price,
          costPrice: i.costPrice,
        })),
        bottleReturns: dto.bottleReturns,
        commandTabId: tabId,
        skipStock: true,
        role,
        allowOverCreditLimit: dto.allowOverCreditLimit,
      });
    });
    return this.sales.get(storeId, saleId);
  }

  /** Cancela a comanda: devolve o estoque de todos os itens e a tira da lista (soft delete). */
  async cancel(storeId: string, tabId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOpenTab(tx, storeId, tabId);
      const items = await tx.commandItem.findMany({
        where: { commandTabId: tabId },
      });

      const back = new Map<string, number>();
      for (const i of items)
        back.set(
          i.storeProductId,
          (back.get(i.storeProductId) ?? 0) + i.quantity,
        );
      await this.returnStock(tx, storeId, back);

      const now = new Date();
      await tx.commandItem.updateMany({
        where: { commandTabId: tabId },
        data: { deletedAt: now },
      });
      await tx.commandTab.update({
        where: { id: tabId },
        data: { status: 'CLOSED', deletedAt: now },
      });
    });
    return { message: 'Comanda cancelada.' };
  }

  /**
   * Trava a linha da comanda (FOR UPDATE) e confirma que ela é desta loja e está aberta. Assim
   * adicionar item, remover, fechar e cancelar nunca correm uns contra os outros.
   */
  private async lockOpenTab(tx: PrismaTx, storeId: string, tabId: string) {
    await tx.$queryRaw`SELECT id FROM tb_command_tabs WHERE id = ${tabId} AND "storeId" = ${storeId} FOR UPDATE`;
    const tab = await tx.commandTab.findFirst({
      where: { id: tabId, storeId },
    });
    if (!tab) throw new NotFoundException('Comanda não encontrada.');
    if (tab.status === 'CLOSED')
      throw new ConflictException('Esta comanda já está fechada.');
    return tab;
  }

  /** Devolve estoque (a oferta do produto pode ter sido removida da loja depois). */
  private async returnStock(
    tx: PrismaTx,
    storeId: string,
    quantities: Map<string, number>,
  ) {
    for (const [storeProductId, quantity] of [...quantities].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      await this.audit.withDeleted(() =>
        tx.storeProduct.updateMany({
          where: { id: storeProductId, storeId },
          data: { stock: { increment: quantity } },
        }),
      );
    }
  }
}
