/** Arredonda para 2 casas decimais (dinheiro está em Float no schema). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Converte para centavos inteiros: comparar valores em centavos evita erro de ponto flutuante. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}
