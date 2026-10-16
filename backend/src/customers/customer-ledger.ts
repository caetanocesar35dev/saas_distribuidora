import { ConflictException } from '@nestjs/common';
import { roundMoney } from '../common/utils/money';
import { PrismaTx } from '../prisma/prisma.extension';

const MAX_ATTEMPTS = 5;

/**
 * Altera o saldo de fiado (dinheiro) do cliente em uma loja. É o ÚNICO caminho para mexer em
 * CustomerStoreBalance.balance, que não tem histórico no banco: toda alteração precisa estar
 * ligada a uma venda fiado (ou seu cancelamento) ou a uma alocação de pagamento.
 *
 * O saldo é Float, então a conta é feita na aplicação com arredondamento de centavos e gravada por
 * comparação-e-troca (o UPDATE só vale se o saldo ainda for o que foi lido). Assim não há resíduo de
 * ponto flutuante nem perda de atualização concorrente.
 *
 * @returns o saldo novo
 */
export async function addCustomerDebt(
  tx: PrismaTx,
  customerId: string,
  storeId: string,
  delta: number,
  opts: { allowNegative?: boolean } = {},
): Promise<number> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const row = await tx.customerStoreBalance.findFirst({
      where: { customerId, storeId },
    });

    if (!row) {
      if (delta < 0)
        throw new ConflictException('O cliente não tem dívida nesta loja.');
      await tx.customerStoreBalance.create({
        data: { customerId, storeId, balance: roundMoney(delta) },
      });
      return roundMoney(delta);
    }

    const next = roundMoney(row.balance + delta);
    if (next < 0 && !opts.allowNegative) {
      throw new ConflictException(
        'O valor é maior que a dívida do cliente nesta loja.',
      );
    }
    const updated = await tx.customerStoreBalance.updateMany({
      where: { id: row.id, balance: row.balance },
      data: { balance: next },
    });
    if (updated.count === 1) return next;
  }
  throw new ConflictException(
    'Não foi possível atualizar o saldo do cliente agora. Tente novamente.',
  );
}
