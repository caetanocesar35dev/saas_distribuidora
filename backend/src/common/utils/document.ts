export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Valor de cada caractere no cálculo do dígito verificador: o código ASCII menos 48. Para
 * dígitos dá o próprio número; para letras (CNPJ alfanumérico) dá A=17, B=18 ... Z=42.
 */
function charValue(ch: string): number {
  return ch.charCodeAt(0) - 48;
}

function checkDigit(chars: string, weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + charValue(chars[i]) * w, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

const CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * CNPJ sem máscara e em maiúsculas. Desde julho de 2026 o CNPJ pode ser alfanumérico (IN RFB
 * 2.229/2024): os 12 primeiros caracteres são letras ou dígitos e os 2 últimos (dígitos
 * verificadores) continuam numéricos. Só tira pontuação: outro caractere deixa o CNPJ inválido.
 */
export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[.\-/\s]/g, '');
}

/** Confere formato e dígitos verificadores do CNPJ numérico ou alfanumérico. */
export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1+$/.test(cnpj)) return false;
  const d1 = checkDigit(cnpj, CNPJ_W1);
  const d2 = checkDigit(cnpj, CNPJ_W2);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const d1 = checkDigit(cpf, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(cpf, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

/** Gera um CNPJ válido a partir de 12 caracteres-base (útil em testes e no seed). */
export function buildCnpj(base12: string): string {
  const base = normalizeCnpj(base12).padStart(12, '0').slice(0, 12);
  const d1 = checkDigit(base, CNPJ_W1);
  const d2 = checkDigit(base + d1, CNPJ_W2);
  return `${base}${d1}${d2}`;
}
