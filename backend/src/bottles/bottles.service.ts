import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BottlesService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================
  // BOTTLE TYPES
  // =====================

  async findAllTypes() {
    return this.prisma.bottleType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createType(data: { name: string; initialStock?: number }) {
    return this.prisma.bottleType.create({
      data: {
        name: data.name,
        stock: data.initialStock || 0,
      },
    });
  }

  async updateType(id: number, data: { name?: string; stock?: number }) {
    return this.prisma.bottleType.update({
      where: { id },
      data,
    });
  }

  async deleteType(id: number) {
    // Verificar se tem balances de clientes amarrados
    const balances = await this.prisma.customerBottleBalance.count({
      where: { bottleTypeId: id, balance: { gt: 0 } }
    });
    if (balances > 0) {
      throw new BadRequestException("Não é possível excluir: existem clientes devendo este vasilhame.");
    }
    
    return this.prisma.bottleType.delete({
      where: { id },
    });
  }

  // =====================
  // MOVEMENTS
  // =====================

  async registerMovement(data: {
    bottleTypeId: number;
    quantity: number;
    type: 'CUSTOMER_BORROW' | 'CUSTOMER_RETURN' | 'SUPPLIER_SEND' | 'SUPPLIER_RECEIVE' | 'MANUAL_ADJUSTMENT';
    customerId?: number;
    saleId?: number;
    description?: string;
  }) {
    if (data.quantity <= 0) {
      throw new BadRequestException("A quantidade deve ser maior que zero.");
    }

    if ((data.type === 'CUSTOMER_BORROW' || data.type === 'CUSTOMER_RETURN') && !data.customerId) {
      throw new BadRequestException("ID do cliente é obrigatório para operações de empréstimo/devolução.");
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Determina impacto no estoque da loja
      let stockChange = 0;
      if (data.type === 'CUSTOMER_RETURN' || data.type === 'SUPPLIER_RECEIVE') {
        stockChange = data.quantity; // Entra na loja
      } else if (data.type === 'CUSTOMER_BORROW' || data.type === 'SUPPLIER_SEND') {
        stockChange = -data.quantity; // Sai da loja
      } else if (data.type === 'MANUAL_ADJUSTMENT') {
        // Assume que ajuste manual o front manda quantity positivo ou negativo
        // Mas como bloqueamos <= 0, ajustaremos o front para enviar o stock final e a API calcula a diff.
        // Ou o front já envia se é entrada ou saída no tipo
        stockChange = data.quantity; // Aqui vamos assumir que o front tratará se é adição ou subtração antes.
      }

      // Atualiza estoque
      const type = await tx.bottleType.update({
        where: { id: data.bottleTypeId },
        data: { stock: { increment: stockChange } }
      });

      // 2. Determina impacto no saldo do cliente
      if (data.customerId && (data.type === 'CUSTOMER_BORROW' || data.type === 'CUSTOMER_RETURN')) {
        const balanceChange = data.type === 'CUSTOMER_BORROW' ? data.quantity : -data.quantity;

        // Upsert customer balance
        await tx.customerBottleBalance.upsert({
          where: {
            customerId_bottleTypeId: {
              customerId: data.customerId,
              bottleTypeId: data.bottleTypeId,
            }
          },
          update: {
            balance: { increment: balanceChange }
          },
          create: {
            customerId: data.customerId,
            bottleTypeId: data.bottleTypeId,
            balance: balanceChange,
          }
        });
      }

      // 3. Registra movimentação
      return tx.bottleMovement.create({
        data: {
          bottleTypeId: data.bottleTypeId,
          quantity: data.quantity, // guardamos o valor absoluto
          type: data.type,
          customerId: data.customerId,
          saleId: data.saleId,
          description: data.description,
        }
      });
    });
  }

  // =====================
  // CUSTOMER DASHBOARD
  // =====================

  async getCustomerBalances(customerId: number) {
    return this.prisma.customerBottleBalance.findMany({
      where: { customerId },
      include: {
        bottleType: true,
      }
    });
  }

  async getRecentMovements() {
    return this.prisma.bottleMovement.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        bottleType: true,
        customer: {
          select: { id: true, name: true }
        },
        sale: {
          select: { id: true, createdAt: true }
        }
      }
    });
  }
}
