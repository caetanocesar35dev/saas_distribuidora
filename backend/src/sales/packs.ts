import { BadRequestException } from '@nestjs/common';

/**
 * Venda em lote (decisão do usuário): o operador informa fardos e unidades avulsas; o estoque, o
 * preço e os vasilhames continuam em unidades. O preço do fardo é o da unidade × unidades do
 * fardo. `packSize` é o `packQuantity` do produto no momento da venda (fica gravado no item).
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
