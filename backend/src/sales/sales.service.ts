import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, SaleStatus, CashStatus, MovementType } from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async create(body: { paymentMethod: PaymentMethod; customerId?: number; discount?: number; skipStockUpdate?: boolean; commandTabId?: number; items: { productId: number; quantity: number }[]; bottleMovements?: { bottleTypeId: number; quantity: number; type: 'CUSTOMER_BORROW' | 'CUSTOMER_RETURN' }[] }, userId?: number) {
    if (!body.items || body.items.length === 0) {
      throw new BadRequestException('A venda deve conter pelo menos um item.');
    }

    if (body.paymentMethod === 'CREDIT_STORE' && !body.customerId) {
      throw new BadRequestException('Para vendas a prazo (Fiado), é obrigatório informar o cliente.');
    }

    // Executar a venda em uma transação de banco de dados
    return this.prisma.$transaction(async (tx) => {
      // 1. Verificar se o caixa está aberto
      const activeCash = await tx.cashRegister.findFirst({
        where: { status: CashStatus.OPEN },
      });
      if (!activeCash) {
        throw new BadRequestException('Não há caixa aberto. Abra o caixa antes de realizar vendas.');
      }

      let total = 0;
      let totalCost = 0;
      const saleItemsData: { productId: number; quantity: number; price: number; costPrice: number }[] = [];
      const stockUpdates: { productId: number; newStock: number }[] = [];

      // 2. Validar estoque e calcular o total com base no preço do cadastro (preço fixo)
      for (const item of body.items) {
        if (item.quantity <= 0) {
          throw new BadRequestException('A quantidade de cada produto deve ser maior que zero.');
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(`Produto com ID ${item.productId} não encontrado.`);
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente para o produto "${product.name}". Estoque atual: ${product.stock}, solicitado: ${item.quantity}.`
          );
        }

        const itemTotal = product.price * item.quantity;
        const itemTotalCost = product.costPrice * item.quantity;
        total += itemTotal;
        totalCost += itemTotalCost;

        saleItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.price,
          costPrice: product.costPrice,
        });

        stockUpdates.push({
          productId: product.id,
          newStock: product.stock - item.quantity,
        });
      }

      // 3. Atualizar estoques dos produtos
      if (!body.skipStockUpdate) {
        for (const update of stockUpdates) {
          await tx.product.update({
            where: { id: update.productId },
            data: { stock: update.newStock },
          });
        }
      }

      // 4. Aplicar Desconto
      let discount = body.discount || 0;
      if (discount < 0) discount = 0;
      if (discount > total) {
        throw new BadRequestException('O desconto não pode ser maior que o valor total da venda.');
      }
      total = total - discount;

      // 5. Criar a venda com seus itens
      const sale = await tx.sale.create({
        data: {
          total,
          totalCost,
          discount,
          paymentMethod: body.paymentMethod,
          customerId: body.customerId,
          commandTabId: body.commandTabId,
          userId,
          status: SaleStatus.COMPLETED,
          items: {
            create: saleItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // 5. Atualiza o caixa ou o saldo do cliente
      if (body.paymentMethod === 'CREDIT_STORE' && body.customerId) {
        // Venda a prazo: aumenta a dívida do cliente e NÃO mexe no caixa
        await tx.customer.update({
          where: { id: body.customerId },
          data: { balance: { increment: total } },
        });
      } else {
        // Venda à vista: registra movimentação de entrada no caixa
        await tx.cashMovement.create({
          data: {
            cashRegisterId: activeCash.id,
            type: MovementType.SALE,
            amount: total,
            description: `Venda registrada #${sale.id}`,
          },
        });
      }

      // 6. Registrar Movimentações de Vasilhames
      const requiredBottles = new Map<number, number>();
      for (const item of sale.items) {
        if (item.product.bottleTypeId) {
          const current = requiredBottles.get(item.product.bottleTypeId) || 0;
          requiredBottles.set(item.product.bottleTypeId, current + item.quantity);
        }
      }

      const returnedBottlesMap = new Map<number, number>();
      if (body.bottleMovements) {
        for (const bm of body.bottleMovements) {
          if (bm.type === 'CUSTOMER_RETURN' && bm.quantity > 0) {
            const current = returnedBottlesMap.get(bm.bottleTypeId) || 0;
            returnedBottlesMap.set(bm.bottleTypeId, current + bm.quantity);
          }
        }
      }

      const allBottleTypeIds = new Set([...requiredBottles.keys(), ...returnedBottlesMap.keys()]);
      
      for (const typeId of allBottleTypeIds) {
        const taken = requiredBottles.get(typeId) || 0;
        const returned = returnedBottlesMap.get(typeId) || 0;
        const diff = taken - returned;

        if (diff !== 0 && !body.customerId) {
          throw new BadRequestException('Para ficar com saldo devedor ou credor de vasilhames, é obrigatório selecionar um cliente na venda.');
        }

        // Se levou > 0, registra a saída
        if (taken > 0) {
          await tx.bottleType.update({
            where: { id: typeId },
            data: { stock: { decrement: taken } }
          });
          if (body.customerId) {
            await tx.customerBottleBalance.upsert({
              where: { customerId_bottleTypeId: { customerId: body.customerId, bottleTypeId: typeId } },
              update: { balance: { increment: taken } },
              create: { customerId: body.customerId, bottleTypeId: typeId, balance: taken }
            });
          }
          await tx.bottleMovement.create({
            data: {
              bottleTypeId: typeId,
              quantity: taken,
              type: 'CUSTOMER_BORROW',
              customerId: body.customerId || null,
              saleId: sale.id,
              description: `Empréstimo automático (Venda #${sale.id})`
            }
          });
        }

        // Se devolveu > 0, registra a entrada
        if (returned > 0) {
          await tx.bottleType.update({
            where: { id: typeId },
            data: { stock: { increment: returned } }
          });
          if (body.customerId) {
            await tx.customerBottleBalance.upsert({
              where: { customerId_bottleTypeId: { customerId: body.customerId, bottleTypeId: typeId } },
              update: { balance: { decrement: returned } },
              create: { customerId: body.customerId, bottleTypeId: typeId, balance: -returned }
            });
          }
          await tx.bottleMovement.create({
            data: {
              bottleTypeId: typeId,
              quantity: returned,
              type: 'CUSTOMER_RETURN',
              customerId: body.customerId || null,
              saleId: sale.id,
              description: `Devolução no PDV (Venda #${sale.id})`
            }
          });
        }
      }

      return sale;
    });
  }

  async findAll(query: {
    page?: string;
    limit?: string;
    search?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search && !isNaN(Number(query.search))) {
      where.id = Number(query.search);
    }

    if (query.paymentMethod && query.paymentMethod !== 'ALL') {
      where.paymentMethod = query.paymentMethod as PaymentMethod;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [data, totalCount] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
          commandTab: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ]);

    // Calcular lucro e receita totais
    const aggregations = await this.prisma.sale.aggregate({
      where: { ...where, status: { not: SaleStatus.CANCELED } },
      _sum: {
        total: true,
        totalCost: true,
      },
    });

    const totalRevenue = aggregations._sum.total || 0;
    const totalCost = aggregations._sum.totalCost || 0;
    const totalProfit = totalRevenue - totalCost;

    return {
      data,
      meta: {
        totalItems: totalCount,
        totalRevenue,
        totalProfit,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        commandTab: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Venda não encontrada.');
    }

    return sale;
  }

  async cancel(id: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Buscar a venda e seus itens
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!sale) {
        throw new NotFoundException('Venda não encontrada.');
      }

      if (sale.status === SaleStatus.CANCELED) {
        throw new BadRequestException('Esta venda já está cancelada.');
      }

      // 2. Verificar se há caixa aberto para registrar o estorno
      const activeCash = await tx.cashRegister.findFirst({
        where: { status: CashStatus.OPEN },
      });
      if (!activeCash) {
        throw new BadRequestException('Para cancelar uma venda, o caixa deve estar aberto para registrar o estorno.');
      }

      // 3. Devolver produtos ao estoque
      for (const item of sale.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (product) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: product.stock + item.quantity,
            },
          });
        }
      }

      // 4. Reverter movimentações de vasilhames
      const bottleMovements = await tx.bottleMovement.findMany({
        where: { saleId: sale.id },
      });

      for (const bm of bottleMovements) {
        if (bm.type === 'CUSTOMER_BORROW') {
          // Devolver vasilhames ao estoque da loja
          await tx.bottleType.update({
            where: { id: bm.bottleTypeId },
            data: { stock: { increment: bm.quantity } },
          });
          // Reduzir saldo devedor do cliente
          if (bm.customerId) {
            await tx.customerBottleBalance.update({
              where: {
                customerId_bottleTypeId: {
                  customerId: bm.customerId,
                  bottleTypeId: bm.bottleTypeId,
                },
              },
              data: { balance: { decrement: bm.quantity } },
            });
          }
        } else if (bm.type === 'CUSTOMER_RETURN') {
          // Retirar vasilhames do estoque da loja (a devolução não aconteceu mais)
          await tx.bottleType.update({
            where: { id: bm.bottleTypeId },
            data: { stock: { decrement: bm.quantity } },
          });
          // Restaurar saldo devedor do cliente
          if (bm.customerId) {
            await tx.customerBottleBalance.update({
              where: {
                customerId_bottleTypeId: {
                  customerId: bm.customerId,
                  bottleTypeId: bm.bottleTypeId,
                },
              },
              data: { balance: { increment: bm.quantity } },
            });
          }
        }
      }

      // Excluir os registros de movimentação revertidos
      if (bottleMovements.length > 0) {
        await tx.bottleMovement.deleteMany({
          where: { saleId: sale.id },
        });
      }

      // 5. Alterar status da venda para cancelada
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.CANCELED,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // 6. Estornar saldo ou registrar movimentação de saída no caixa
      if (sale.paymentMethod === 'CREDIT_STORE' && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { balance: { decrement: sale.total } },
        });
      } else {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: activeCash.id,
            type: MovementType.OUT,
            amount: sale.total,
            description: `Cancelamento da Venda #${sale.id}`,
          },
        });
      }

      return updatedSale;
    });
  }
}
