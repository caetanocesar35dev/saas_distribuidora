import { roundMoney } from '../common/utils/money';
import { addDays, startOfDayInTz } from '../common/utils/time';
import { PrismaTx } from '../prisma/prisma.extension';
import { PrismaService } from '../prisma/prisma.service';
import { lockCashExclusive } from './cash-lock';

/**
 * Caixa sem depender de abrir e fechar à mão (decisão do usuário, 2026-10-26):
 *  - a primeira operação com dinheiro abre o caixa sozinha (`ensureOpenCash`), com o troco inicial
 *    igual ao saldo do último fechamento;
 *  - o caixa esquecido aberto fecha sozinho no horário da loja (`autoCloseDue` + o job
 *    `CashAutoCloseJob`), marcado `autoClosed`.
 * Abrir e fechar à mão continuam funcionando (Menu › Caixa).
 */

/** Abre o caixa da loja se não houver um aberto. Chamar DENTRO de uma transação com a trava exclusiva. */
export async function openCashIfNeeded(
  tx: PrismaTx,
  storeId: string,
): Promise<void> {
  const open = await tx.cashRegister.findFirst({
    where: { storeId, status: 'OPEN' },
    select: { id: true },
  });
  if (open) return;
  const last = await tx.cashRegister.findFirst({
    where: { storeId, status: 'CLOSED' },
    orderBy: { closedAt: 'desc' },
    select: { finalBalance: true },
  });
  await tx.cashRegister.create({
    data: {
      storeId,
      initialBalance: roundMoney(last?.finalBalance ?? 0),
      status: 'OPEN',
    },
  });
}

/**
 * Garante caixa aberto antes de uma operação com dinheiro (venda, fechamento de comanda,
 * recebimento de fiado, cancelamento). Roda numa transação curta e própria, com a trava exclusiva,
 * ANTES da transação da operação (que usa a trava compartilhada).
 */
export async function ensureOpenCash(
  prisma: PrismaService,
  storeId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockCashExclusive(tx, storeId);
    await openCashIfNeeded(tx, storeId);
  });
}

/** "HH:mm" válido (00:00 a 23:59). */
export const CASH_CLOSE_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Quando um caixa aberto em `openedAt` deve fechar sozinho: a primeira vez, DEPOIS da abertura,
 * que o relógio da loja (fuso `timeZone`) chega a `time` ("HH:mm").
 */
export function autoCloseDue(
  openedAt: Date,
  time: string,
  timeZone: string,
): Date {
  const [h, m] = (CASH_CLOSE_TIME_REGEX.test(time) ? time : '00:00')
    .split(':')
    .map(Number);
  let due = new Date(
    startOfDayInTz(openedAt, timeZone).getTime() + (h * 60 + m) * 60_000,
  );
  if (due.getTime() <= openedAt.getTime()) due = addDays(due, 1);
  return due;
}
