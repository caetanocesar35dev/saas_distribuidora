import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType, PaymentMethod, Prisma } from '@prisma/client';
import {
  paginate,
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { fromCents, roundMoney, toCents } from '../common/utils/money';
import { PrismaTx } from '../prisma/prisma.extension';
import { PrismaService } from '../prisma/prisma.service';
import { openCashIfNeeded } from './cash-auto';
import { lockCashExclusive } from './cash-lock';
import { CashMovementDto } from './dto/cash-register.dto';

const MOVEMENT_SELECT = {
  id: true,
  type: true,
  amount: true,
  description: true,
  createdAt: true,
} satisfies Prisma.CashMovementSelect;

type Reader = Pick<PrismaTx, 'cashMovement'>;

export interface PaymentSummaryLine {
  paymentMethod: PaymentMethod;
  count: number;
  total: number;
}

/**
 * Saldo do caixa = inicial + entradas (IN) + vendas (SALE) − saídas (OUT). Somado em centavos
 * para não acumular erro de ponto flutuante.
 */
export async function computeCashBalance(
  db: Reader,
  cashRegisterId: string,
  initialBalance: number,
): Promise<number> {
  const rows = await db.cashMovement.groupBy({
    by: ['type'],
    where: { cashRegisterId },
    _sum: { amount: true },
  });
  let cents = toCents(initialBalance);
  for (const row of rows) {
    const value = toCents(row._sum.amount ?? 0);
    cents += row.type === MovementType.OUT ? -value : value;
  }
  return fromCents(cents);
}

@Injectable()
export class CashRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  /** Um caixa aberto por loja. */
  async open(storeId: string, initialBalance: number) {
    return this.prisma.$transaction(async (tx) => {
      await lockCashExclusive(tx, storeId);
      const open = await tx.cashRegister.findFirst({
        where: { storeId, status: 'OPEN' },
      });
      if (open) {
        throw new ConflictException(
          'Já existe um caixa aberto nesta loja. Feche-o antes de abrir outro.',
        );
      }
      return tx.cashRegister.create({
        data: {
          storeId,
          initialBalance: roundMoney(initialBalance),
          status: 'OPEN',
        },
      });
    });
  }

  /** Caixa aberto da loja com as movimentações e o saldo atual, ou null se não houver. */
  async current(storeId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { storeId, status: 'OPEN' },
      include: {
        movements: {
          where: { deletedAt: null },
          select: MOVEMENT_SELECT,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!register) return null;
    return {
      ...register,
      currentBalance: await computeCashBalance(
        this.prisma,
        register.id,
        register.initialBalance,
      ),
    };
  }

  /**
   * Fecha o caixa: grava o saldo final e devolve, para conferência, o resumo das vendas do período
   * por forma de pagamento. (O movimento SALE não guarda a forma de pagamento, então o saldo do caixa
   * soma dinheiro, PIX e cartão; a separação vem do resumo das vendas.)
   */
  async close(storeId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockCashExclusive(tx, storeId);
      const register = await tx.cashRegister.findFirst({
        where: { storeId, status: 'OPEN' },
      });
      if (!register)
        throw new ConflictException(
          'Não há caixa aberto para fechar nesta loja.',
        );

      const finalBalance = await computeCashBalance(
        tx,
        register.id,
        register.initialBalance,
      );
      const closed = await tx.cashRegister.update({
        where: { id: register.id },
        data: { status: 'CLOSED', closedAt: new Date(), finalBalance },
      });
      return {
        register: closed,
        summary: await this.salesSummary(tx, storeId, register.openedAt),
      };
    });
  }

  /**
   * Fecha sozinho o caixa esquecido aberto (job `CashAutoCloseJob`, no horário da loja). Mesmo
   * cálculo do fechamento à mão, marcado `autoClosed`. Devolve false se ele já foi fechado.
   */
  async closeAutomatically(storeId: string, registerId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockCashExclusive(tx, storeId);
      const register = await tx.cashRegister.findFirst({
        where: { id: registerId, storeId, status: 'OPEN' },
      });
      if (!register) return false;
      const finalBalance = await computeCashBalance(
        tx,
        register.id,
        register.initialBalance,
      );
      await tx.cashRegister.update({
        where: { id: register.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          finalBalance,
          autoClosed: true,
        },
      });
      return true;
    });
  }

  /**
   * Entrada ou saída manual. A saída não pode deixar o saldo do caixa negativo. Sem caixa aberto,
   * abre um sozinho (com o saldo do último fechamento).
   */
  async addMovement(storeId: string, dto: CashMovementDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockCashExclusive(tx, storeId);
      await openCashIfNeeded(tx, storeId);
      const register = await tx.cashRegister.findFirst({
        where: { storeId, status: 'OPEN' },
      });
      if (!register)
        throw new ConflictException(
          'Não há caixa aberto: abra o caixa para registrar movimentações.',
        );

      if (dto.type === 'OUT') {
        const balance = await computeCashBalance(
          tx,
          register.id,
          register.initialBalance,
        );
        if (toCents(balance) < toCents(dto.amount)) {
          throw new ConflictException(
            `Saldo insuficiente em caixa. Saldo atual: R$ ${balance.toFixed(2)}.`,
          );
        }
      }
      return tx.cashMovement.create({
        data: {
          cashRegisterId: register.id,
          type: dto.type,
          amount: roundMoney(dto.amount),
          description: dto.description,
        },
        select: MOVEMENT_SELECT,
      });
    });
  }

  /** Caixas fechados, do mais recente para o mais antigo. */
  async history(storeId: string, query: PaginationQueryDto) {
    const where: Prisma.CashRegisterWhereInput = { storeId, status: 'CLOSED' };
    const [data, total] = await Promise.all([
      this.prisma.cashRegister.findMany({
        where,
        orderBy: { openedAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.cashRegister.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  /** Detalhe de um caixa (aberto ou fechado) com as movimentações e o resumo das vendas do período. */
  async get(storeId: string, id: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id, storeId },
      include: {
        movements: {
          where: { deletedAt: null },
          select: MOVEMENT_SELECT,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!register) throw new NotFoundException('Caixa não encontrado.');
    const until = register.closedAt ?? new Date();
    return {
      ...register,
      currentBalance: await computeCashBalance(
        this.prisma,
        register.id,
        register.initialBalance,
      ),
      summary: await this.salesSummary(
        this.prisma,
        storeId,
        register.openedAt,
        until,
      ),
    };
  }

  private async salesSummary(
    db: Pick<PrismaTx, 'sale'>,
    storeId: string,
    from: Date,
    until?: Date,
  ): Promise<PaymentSummaryLine[]> {
    const period = { gte: from, ...(until ? { lte: until } : {}) };
    const rows = await db.sale.groupBy({
      by: ['paymentMethod'],
      where: {
        storeId,
        status: 'COMPLETED',
        // Venda antiga lançada depois conta no caixa em que foi lançada (o dinheiro entrou nele),
        // não no dia em que aconteceu.
        OR: [
          { registeredAt: null, createdAt: period },
          { registeredAt: period },
        ],
      },
      _sum: { total: true },
      _count: { _all: true },
    });
    return rows
      .map((r) => ({
        paymentMethod: r.paymentMethod,
        count: r._count._all,
        total: roundMoney(r._sum.total ?? 0),
      }))
      .sort((a, b) => a.paymentMethod.localeCompare(b.paymentMethod));
  }
}
