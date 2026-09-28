import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, CashStatus, MovementType } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; phone?: string }) {
    if (!data.name) {
      throw new BadRequestException('O nome do cliente é obrigatório.');
    }
    return this.prisma.customer.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: {
        bottleBalances: {
          include: { bottleType: true }
        }
      }
    });
  }

  async findOne(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        sales: { 
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' } 
        },
        bottleBalances: {
          include: { bottleType: true }
        },
        bottleMovements: {
          include: { bottleType: true, sale: { select: { id: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    return customer;
  }

  async update(id: number, data: { name?: string; phone?: string }) {
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async payDebt(id: number, amount: number, paymentMethod: PaymentMethod) {
    if (amount <= 0) {
      throw new BadRequestException('O valor do pagamento deve ser maior que zero.');
    }

    if (paymentMethod === 'CREDIT_STORE') {
      throw new BadRequestException('Forma de pagamento inválida para quitação de fiado.');
    }

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');

      if (customer.balance < amount) {
        throw new BadRequestException(`O valor informado (R$ ${amount}) é maior que a dívida atual (R$ ${customer.balance}).`);
      }

      // Verifica se o caixa está aberto
      const activeCash = await tx.cashRegister.findFirst({
        where: { status: CashStatus.OPEN },
      });

      if (!activeCash) {
        throw new BadRequestException('Não há caixa aberto para registrar o pagamento.');
      }

      // Cria o registro do pagamento
      const payment = await tx.customerPayment.create({
        data: {
          customerId: id,
          amount,
          paymentMethod,
        }
      });

      // Abate no saldo do cliente
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: { balance: customer.balance - amount },
      });

      // Registra entrada no caixa
      await tx.cashMovement.create({
        data: {
          cashRegisterId: activeCash.id,
          type: MovementType.IN,
          amount,
          description: `Pagamento de Fiado - Cliente: ${customer.name}`,
        }
      });

      return updatedCustomer;
    });
  }
}
