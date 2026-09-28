import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashStatus, MovementType } from '@prisma/client';

@Injectable()
export class CashRegisterService {
  constructor(private prisma: PrismaService) { }

  async getCurrent() {
    const current = await this.prisma.cashRegister.findFirst({
      where: { status: CashStatus.OPEN },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return current;
  }

  async open(initialBalance: number) {
    const active = await this.getCurrent();
    if (active) {
      throw new BadRequestException('Já existe um caixa aberto. É necessário fechá-lo antes de abrir um novo.');
    }

    if (initialBalance < 0) {
      throw new BadRequestException('O saldo inicial não pode ser negativo');
    }

    return this.prisma.cashRegister.create({
      data: {
        initialBalance: Number(initialBalance),
        status: CashStatus.OPEN,
      },
    });
  }

  async close() {
    const active = await this.getCurrent();
    if (!active) {
      throw new BadRequestException('Não há nenhum caixa aberto para fechar.');
    }

    // Calcular o saldo final com base no saldo inicial e movimentações
    let finalBalance = active.initialBalance;
    for (const movement of active.movements) {
      if (movement.type === MovementType.IN || movement.type === MovementType.SALE) {
        finalBalance += movement.amount;
      } else if (movement.type === MovementType.OUT) {
        finalBalance -= movement.amount;
      }
    }

    return this.prisma.cashRegister.update({
      where: { id: active.id },
      data: {
        status: CashStatus.CLOSED,
        closedAt: new Date(),
        finalBalance: finalBalance,
      },
    });
  }

  async addMovement(type: MovementType, amount: number, description?: string) {
    const active = await this.getCurrent();
    if (!active) {
      throw new BadRequestException('Não é possível registrar movimentações com o caixa fechado.');
    }

    if (amount <= 0) {
      throw new BadRequestException('O valor da movimentação deve ser maior que zero');
    }

    // Se for saída, valida se há saldo suficiente em caixa
    if (type === MovementType.OUT) {
      let currentBalance = active.initialBalance;
      for (const movement of active.movements) {
        if (movement.type === MovementType.IN || movement.type === MovementType.SALE) {
          currentBalance += movement.amount;
        } else if (movement.type === MovementType.OUT) {
          currentBalance -= movement.amount;
        }
      }
      if (currentBalance < amount) {
        throw new BadRequestException(`Saldo insuficiente em caixa. Saldo atual: R$ ${currentBalance.toFixed(2)}`);
      }
    }

    return this.prisma.cashMovement.create({
      data: {
        cashRegisterId: active.id,
        type,
        amount: Number(amount),
        description,
      },
    });
  }

  async getHistory() {
    return this.prisma.cashRegister.findMany({
      where: { status: CashStatus.CLOSED },
      include: {
        movements: true,
      },
      orderBy: { openedAt: 'desc' },
    });
  }
}
