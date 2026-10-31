import type { DiscountReason, ReferralRules, ReferralStatus } from "@/lib/api/types";

/** Programa de indicação (decisão do usuário, 2026-10-30). Regras no backend: `referral-rules.ts`. */

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  PENDING: "Aguardando o 1º pagamento",
  CONFIRMED: "Confirmada",
  CANCELED: "Cancelada",
};

export const DISCOUNT_REASON_LABEL: Record<DiscountReason, string> = {
  REFERRED: "Você foi indicado",
  REFERRER: "Você indicou",
};

/** Maiúsculas, sem espaços nem acentos (o mesmo que o backend faz). */
export function normalizeReferralCode(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** Link de cadastro que já preenche o código. */
export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/cadastro?ref=${encodeURIComponent(code)}`;
}

/** Mensagem pronta para mandar no WhatsApp. */
export function referralMessage(link: string, code: string, rules: ReferralRules): string {
  return (
    `Uso este sistema na minha distribuidora para controlar vendas, caixa, estoque, fiado e vasilhames. ` +
    `Cadastre-se pelo link e ganhe ${rules.discountPercent}% de desconto nos ${rules.discountMonths} ` +
    `primeiros meses depois do teste grátis: ${link} (código ${code}).`
  );
}

export const whatsappShareUrl = (message: string) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;

/** "2 meses com 20% de desconto" (null quando não há meses a usar). */
export function discountText(remainingMonths: number, percent: number): string | null {
  if (remainingMonths <= 0) return null;
  return `${remainingMonths} ${remainingMonths === 1 ? "mês" : "meses"} com ${percent}% de desconto`;
}
