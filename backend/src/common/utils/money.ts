/** Arredonda para 2 casas decimais (dinheiro está em Float no schema). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Custo da unidade: 4 casas, porque vem do custo da embalagem dividido (maço de R$ 9,50 com 20
 * cigarros = R$ 0,475). O total de uma venda continua arredondado para centavos.
 */
export function roundUnitCost(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/** Converte para centavos inteiros: comparar valores em centavos evita erro de ponto flutuante. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}
