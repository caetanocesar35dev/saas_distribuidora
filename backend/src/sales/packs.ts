import { BadRequestException } from '@nestjs/common';
import { roundMoney, toCents } from '../common/utils/money';

/**
 * Venda em lote (decisão do usuário): o operador informa embalagens e unidades avulsas; o estoque e
 * os vasilhames continuam em unidades. `packSize` é o `packQuantity` do produto no momento da venda
 * (fica gravado no item).
 */
export function toUnits(
  productName: string,
  loose: number,
  packs: number,
  packSize: number,
): { units: number; packs: number; packSize: number | null } {
  if (packs > 0 && packSize <= 1) {
    throw new BadRequestException(
      `O produto "${productName}" não é vendido em fardo (o cadastro não informa quantas unidades tem o fardo).`,
    );
  }
  const units = loose + packs * packSize;
  if (units < 1) {
    throw new BadRequestException(
      `A quantidade de "${productName}" deve ser maior que zero.`,
    );
  }
  return { units, packs, packSize: packs > 0 ? packSize : null };
}

/**
 * Valor de um item em centavos. A embalagem usa o preço próprio (`packPrice`) e, sem ele, o da
 * unidade × unidades da embalagem; as avulsas usam o preço da unidade (o cigarro picado costuma ser
 * mais caro que o maço dividido). `quantity` é o total em unidades.
 */
export function itemTotalCents(item: {
  quantity: number;
  packs: number;
  packSize: number | null;
  price: number;
  packPrice: number | null;
}): number {
  const size = item.packSize ?? 0;
  const loose = item.quantity - item.packs * size;
  const pack = item.packPrice ?? item.price * size;
  return toCents(roundMoney(loose * item.price + item.packs * pack));
}
