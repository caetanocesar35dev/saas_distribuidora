import type { ReadOnlyReason, SubscriptionAccess } from "@/lib/api/types";
import { daysUntil, formatDate } from "@/lib/format";

export const READ_ONLY_MESSAGE: Record<ReadOnlyReason, string> = {
  TRIAL_EXPIRED:
    "O período de teste terminou. O sistema está somente para consulta até a assinatura ser regularizada.",
  PAST_DUE:
    "A mensalidade está em atraso. O sistema está somente para consulta até o pagamento ser regularizado.",
  CANCELED:
    "A assinatura foi cancelada. O sistema está somente para consulta.",
};

/** Motivo curto, para a faixa do topo (que já diz que o sistema está somente para consulta). */
const READ_ONLY_REASON: Record<ReadOnlyReason, string> = {
  TRIAL_EXPIRED: "O período de teste terminou.",
  PAST_DUE: "A mensalidade está em atraso.",
  CANCELED: "A assinatura foi cancelada.",
};

export interface SubscriptionNotice {
  tone: "info" | "warning" | "danger";
  title: string;
  description: string;
}

/** Aviso exibido na faixa do topo, ou null quando está tudo em dia. */
export function subscriptionNotice(
  sub: SubscriptionAccess,
  now = new Date(),
): SubscriptionNotice | null {
  if (sub.accessMode === "READ_ONLY") {
    return {
      tone: "danger",
      title: "Sistema somente para consulta",
      description: `${READ_ONLY_REASON[sub.reason ?? "CANCELED"]} Dá para consultar tudo e fechar o caixa já aberto; para voltar a vender e cadastrar, é preciso regularizar a assinatura.`,
    };
  }
  if (sub.accessMode === "GRACE") {
    return {
      tone: "warning",
      title: "Pagamento pendente",
      description: sub.graceEndsAt
        ? `Regularize a mensalidade: o sistema ficará somente para consulta em ${formatDate(sub.graceEndsAt)}.`
        : "Regularize a mensalidade para não perder o acesso completo.",
    };
  }
  if (sub.status === "TRIAL" && sub.trialEndsAt) {
    const days = daysUntil(sub.trialEndsAt, now);
    const text =
      days <= 1 ? "termina hoje ou amanhã" : `termina em ${days} dias`;
    return {
      tone: days <= 3 ? "warning" : "info",
      title: "Período de teste",
      description: `Seu período de teste ${text} (${formatDate(sub.trialEndsAt)}).`,
    };
  }
  return null;
}
