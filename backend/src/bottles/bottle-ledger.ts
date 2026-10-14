import { ConflictException } from '@nestjs/common';
import { BottleMovementType } from '@prisma/client';
import { PrismaTx } from '../prisma/prisma.extension';

/**
 * Regras do vasilhame (compartilhadas por vendas, comandas e movimentações manuais).
 *
 * O estoque de vasilhame por loja (StoreBottleType.stock) e o saldo do cliente
 * (CustomerStoreBottleBalance.balance) NÃO têm histórico no banco: só podem mudar junto com um
 * BottleMovement. Por isso estas funções são o único caminho para alterá-los e cada chamada de
 * negócio deve registrar o movimento correspondente com recordBottleMovement.
 */

/** Soma (ou subtrai) do estoque de vasilhame da loja, criando a linha se preciso. */
export async function addStoreBottleStock(
  tx: PrismaTx,
  storeId: string,
  bottleTypeId: string,
  delta: number,
  allowNegative: boolean,
): Promise<void> {
  if (delta >= 0 || allowNegative) {
    await tx.storeBottleType.upsert({
      where: { storeId_bottleTypeId: { storeId, bottleTypeId } },
      create: { storeId, bottleTypeId, stock: delta },
      update: { stock: { increment: delta }, deletedAt: null },
    });
    return;
  }
  const result = await tx.storeBottleType.updateMany({
    where: { storeId, bottleTypeId, stock: { gte: -delta } },
    data: { stock: { decrement: -delta } },
  });
  if (result.count === 0)
    throw new ConflictException('Estoque de vasilhame insuficiente na loja.');
}

/** Soma (ou subtrai) do saldo de vasilhame que o cliente deve nesta loja. */
export async function addCustomerBottleBalance(
  tx: PrismaTx,
  customerId: string,
  storeId: string,
  bottleTypeId: string,
  delta: number,
): Promise<void> {
  await tx.customerStoreBottleBalance.upsert({
    where: {
      customerId_storeId_bottleTypeId: { customerId, storeId, bottleTypeId },
    },
    create: { customerId, storeId, bottleTypeId, balance: delta },
    update: { balance: { increment: delta }, deletedAt: null },
  });
}

/** Subtrai do saldo do cliente exigindo que ele deva pelo menos `quantity` (devolução). */
export async function returnCustomerBottles(
  tx: PrismaTx,
  customerId: string,
  storeId: string,
  bottleTypeId: string,
  quantity: number,
): Promise<void> {
  const result = await tx.customerStoreBottleBalance.updateMany({
    where: { customerId, storeId, bottleTypeId, balance: { gte: quantity } },
    data: { balance: { decrement: quantity } },
  });
  if (result.count === 0) {
    throw new ConflictException(
      'O cliente não deve essa quantidade de vasilhames nesta loja. ' +
        'A devolução só abate a dívida da própria loja onde o vasilhame foi levado.',
    );
  }
}

export interface BottleMovementInput {
  storeId: string;
  bottleTypeId: string;
  /** Com sinal: positivo entra na loja (devolução/recebimento), negativo sai (empréstimo/envio). */
  quantity: number;
  type: BottleMovementType;
  customerId?: string | null;
  saleId?: string | null;
  description?: string | null;
}

export function recordBottleMovement(tx: PrismaTx, input: BottleMovementInput) {
  return tx.bottleMovement.create({
    data: {
      storeId: input.storeId,
      bottleTypeId: input.bottleTypeId,
      quantity: input.quantity,
      type: input.type,
      customerId: input.customerId ?? null,
      saleId: input.saleId ?? null,
      description: input.description ?? null,
    },
  });
}
