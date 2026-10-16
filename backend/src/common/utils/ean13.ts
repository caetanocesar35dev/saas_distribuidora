/** Dígito verificador do EAN-13 a partir dos 12 primeiros dígitos. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return (
    /^\d{13}$/.test(code) &&
    ean13CheckDigit(code.slice(0, 12)) === Number(code[12])
  );
}

/** Gera um EAN-13 aleatório e válido. */
export function generateEan13(random: () => number = Math.random): string {
  let first12 = '';
  for (let i = 0; i < 12; i++) first12 += Math.floor(random() * 10).toString();
  return first12 + ean13CheckDigit(first12);
}
