import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from '../sales/sales.service';
import { TabStatus } from '@prisma/client';

@Injectable()
export class CommandTabsService {
  constructor(
    private prisma: PrismaService,
    private salesService: SalesService
  ) {}

  async create(data: { name: string; customerId?: number }) {
    return this.prisma.commandTab.create({
      data: {
        name: data.name,
        customerId: data.customerId,
      },
    });
  }

  async findAllOpen() {
    return this.prisma.commandTab.findMany({
      where: { status: TabStatus.OPEN },
      include: {
        items: {
          include: { product: true }
        },
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number) {
    const tab = await this.prisma.commandTab.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true }
        },
        customer: true
      }
    });
    if (!tab) throw new NotFoundException('Comanda não encontrada');
    return tab;
  }

  async addItem(tabId: number, productId: number, quantity: number) {
    if (quantity <= 0) throw new BadRequestException('Quantidade inválida');

    return this.prisma.$transaction(async (tx) => {
      const tab = await tx.commandTab.findUnique({ where: { id: tabId } });
      if (!tab || tab.status === TabStatus.CLOSED) {
        throw new BadRequestException('Comanda não encontrada ou já fechada');
      }

      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new NotFoundException('Produto não encontrado');

      if (product.stock < quantity) {
        throw new BadRequestException(`Estoque insuficiente. Disponível: ${product.stock}`);
      }

      // Reduce stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: product.stock - quantity }
      });

      // Add item to tab
      return tx.commandItem.create({
        data: {
          commandTabId: tabId,
          productId,
          quantity,
          price: product.price,
          costPrice: product.costPrice
        },
        include: { product: true }
      });
    });
  }

  async removeItem(tabId: number, itemId: number) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.commandItem.findUnique({ where: { id: itemId } });
      if (!item || item.commandTabId !== tabId) {
        throw new NotFoundException('Item não encontrado na comanda');
      }

      const tab = await tx.commandTab.findUnique({ where: { id: tabId } });
      if (tab?.status === TabStatus.CLOSED) {
        throw new BadRequestException('Não é possível remover itens de uma comanda fechada');
      }

      // Restore stock
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (product) {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: product.stock + item.quantity }
        });
      }

      // Remove item
      await tx.commandItem.delete({ where: { id: itemId } });
      return { success: true };
    });
  }

  async closeTab(tabId: number, paymentMethod: any, discount?: number, customerId?: number) {
    const tab = await this.findOne(tabId);
    if (tab.status === TabStatus.CLOSED) {
      throw new BadRequestException('Esta comanda já está fechada');
    }

    if (tab.items.length === 0) {
      throw new BadRequestException('Não é possível fechar uma comanda vazia');
    }

    // Prepare items for SalesService
    const saleItems = tab.items.map(i => ({
      productId: i.productId,
      quantity: i.quantity
    }));

    // Generate Sale using SalesService with skipStockUpdate
    const finalCustomerId = customerId || tab.customerId || undefined;
    
    const sale = await this.salesService.create({
      paymentMethod,
      customerId: finalCustomerId,
      discount,
      commandTabId: tabId,
      items: saleItems,
      skipStockUpdate: true // Stock was already reduced when items were added
    });

    // Mark tab as closed
    await this.prisma.commandTab.update({
      where: { id: tabId },
      data: { status: TabStatus.CLOSED }
    });

    return sale;
  }
}
