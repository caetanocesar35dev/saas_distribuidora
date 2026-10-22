import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { hasMinRole } from '../common/decorators/access.decorators';
import { roundMoney, toCents } from '../common/utils/money';
import { PrismaTx } from '../prisma/prisma.extension';

const brl = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

/**
 * Limite de crédito do fiado (decisão do usuário): um limite por cliente, comparado com a
 * dívida somada em TODAS as lojas da empresa. Passando do limite:
 *  - atendente (EMPLOYEE) é bloqueado (403);
 *  - gerente e dono só passam confirmando (`allowOverLimit`); sem isso, 409 com o aviso.
 * Chamar DENTRO da transação da venda, antes de somar a dívida. Trava o cliente para duas vendas
 * simultâneas não passarem juntas do limite.
 */
export async function assertCreditLimit(
  tx: PrismaTx,
  input: {
    customerId: string;
    companyId: string;
    creditLimit: number | null;
    amount: number;
    role: Role;
    allowOverLimit?: boolean;
  },
): Promise<void> {
  const { customerId, companyId, creditLimit, amount, role } = input;
  if (creditLimit === null || amount <= 0) return;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'customer-credit:' + customerId}))`;
  const owed = await tx.customerStoreBalance.aggregate({
    where: { customerId, store: { companyId, deletedAt: null } },
    _sum: { balance: true },
  });
  const current = roundMoney(owed._sum.balance ?? 0);
  const after = roundMoney(current + amount);
  if (toCents(after) <= toCents(creditLimit)) return;

  if (!hasMinRole(role, Role.MANAGER)) {
    // Sem valores: o atendente não pode ver a dívida somada de todas as lojas.
    throw new ForbiddenException(
      'Esta venda passa do limite de crédito do cliente. Só gerente ou dono pode vender no fiado acima do limite.',
    );
  }
  const detail = `O limite de crédito do cliente é ${brl(creditLimit)}; ele deve ${brl(current)} e, com esta venda, passaria a dever ${brl(after)}.`;
  if (!input.allowOverLimit) {
    throw new ConflictException(
      `${detail} Confirme para vender acima do limite.`,
    );
  }
}
