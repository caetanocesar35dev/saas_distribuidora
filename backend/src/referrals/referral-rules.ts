import { randomInt } from 'node:crypto';

/**
 * Regras do programa de indicação (decisão do usuário, 2026-10-30):
 *  - quem se cadastra com um código ganha REFERRAL_DISCOUNT_PERCENT de desconto por
 *    REFERRAL_DISCOUNT_MONTHS meses depois do trial;
 *  - o cliente que indicou ganha o mesmo desconto, mas só quando o indicado paga a 1ª mensalidade;
 *    os descontos se acumulam (um período depois do outro) até REFERRAL_MAX_MONTHS meses a usar;
 *  - o representante (não usa o sistema) ganha uma comissão em dinheiro, uma vez, proporcional ao
 *    plano que o indicado assinou: `commissionPercent` % do preço mensal. Também só quando o
 *    indicado paga.
 */
export const REFERRAL_DISCOUNT_PERCENT = 20;
export const REFERRAL_DISCOUNT_MONTHS = 2;
export const REFERRAL_MAX_MONTHS = 12;
export const DEFAULT_COMMISSION_PERCENT = 50;

/** Letras e números sem os que se confundem (0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const REFERRAL_CODE_REGEX = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
export const REFERRAL_CODE_MESSAGE =
  'O código deve ter de 4 a 20 letras ou números (pode ter hífen, ex.: JOAO-REP).';

/** Maiúsculas, sem espaços nem acentos. */
export function normalizeReferralCode(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function isValidReferralCode(code: string): boolean {
  return (
    code.length >= 4 && code.length <= 20 && REFERRAL_CODE_REGEX.test(code)
  );
}

/** Código no formato PREFIXO-XXX, com o começo do nome (ex.: "Distribuidora Zé" → "DISTRI-7K2"). */
export function buildReferralCode(name: string): string {
  const letters = normalizeReferralCode(name).replace(/[^A-Z0-9]/g, '');
  const prefix = (letters.slice(0, 6) || 'INDICA').padEnd(4, 'X');
  let suffix = '';
  for (let i = 0; i < 3; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${suffix}`;
}

/** Meses de desconto que ainda faltam usar. */
export function remainingMonths(
  discounts: { months: number; monthsUsed: number }[],
): number {
  return discounts.reduce(
    (sum, d) => sum + Math.max(0, d.months - d.monthsUsed),
    0,
  );
}

/** Quantos meses o cliente que indicou ganha agora, sem passar do limite acumulado. */
export function referrerMonthsToGrant(currentRemaining: number): number {
  return Math.max(
    0,
    Math.min(REFERRAL_DISCOUNT_MONTHS, REFERRAL_MAX_MONTHS - currentRemaining),
  );
}

/** Comissão do representante em centavos: % do preço mensal do plano assinado. */
export function commissionInCents(
  planPriceInCents: number,
  commissionPercent: number,
): number {
  return Math.round((planPriceInCents * commissionPercent) / 100);
}
