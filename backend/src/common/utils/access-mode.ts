import { SubscriptionStatus } from '@prisma/client';
import { addDays } from './time';

export type AccessMode = 'FULL' | 'GRACE' | 'READ_ONLY';
export type ReadOnlyReason =
  'TRIAL_EXPIRED' | 'PAST_DUE' | 'CANCELED' | 'EXEMPTION_EXPIRED';

export interface SubscriptionFields {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  pastDueSince: Date | null;
  /** Só na conta isenta (EXEMPT): até quando vale. null = vitalícia. */
  exemptUntil?: Date | null;
}

export interface SubscriptionAccess {
  status: SubscriptionStatus;
  accessMode: AccessMode;
  reason: ReadOnlyReason | null;
  trialEndsAt: Date | null;
  pastDueSince: Date | null;
  graceEndsAt: Date | null;
  /** Conta isenta: até quando (null = vitalícia ou não é isenta). */
  exemptUntil: Date | null;
}

/**
 * Regra de acesso pela assinatura (decidida pelo usuário). Inadimplência nunca bloqueia o
 * sistema inteiro: o pior caso é o modo somente leitura.
 *
 *  - TRIAL no prazo e ACTIVE: completo
 *  - PAST_DUE até `graceDays` dias depois de `pastDueSince` (inclusive): completo, com aviso
 *  - PAST_DUE depois da carência, TRIAL vencido e CANCELED: somente leitura
 */
export function resolveAccessMode(
  org: SubscriptionFields,
  now: Date,
  graceDays: number,
): SubscriptionAccess {
  const base = {
    status: org.subscriptionStatus,
    trialEndsAt: org.trialEndsAt,
    pastDueSince: org.pastDueSince,
    graceEndsAt: null as Date | null,
    exemptUntil:
      org.subscriptionStatus === 'EXEMPT' ? (org.exemptUntil ?? null) : null,
  };

  switch (org.subscriptionStatus) {
    case 'ACTIVE':
      return { ...base, accessMode: 'FULL', reason: null };

    // Isenta (parceira ou valor único): completo até a data limite; sem data, para sempre.
    case 'EXEMPT':
      if (org.exemptUntil && now.getTime() > org.exemptUntil.getTime()) {
        return {
          ...base,
          accessMode: 'READ_ONLY',
          reason: 'EXEMPTION_EXPIRED',
        };
      }
      return { ...base, accessMode: 'FULL', reason: null };

    case 'TRIAL':
      if (org.trialEndsAt && now.getTime() > org.trialEndsAt.getTime()) {
        return { ...base, accessMode: 'READ_ONLY', reason: 'TRIAL_EXPIRED' };
      }
      return { ...base, accessMode: 'FULL', reason: null };

    case 'PAST_DUE': {
      // Sem data de início do atraso não dá para contar a carência: não bloqueia.
      if (!org.pastDueSince)
        return { ...base, accessMode: 'GRACE', reason: null };
      const graceEndsAt = addDays(org.pastDueSince, graceDays);
      if (now.getTime() <= graceEndsAt.getTime()) {
        return { ...base, graceEndsAt, accessMode: 'GRACE', reason: null };
      }
      return {
        ...base,
        graceEndsAt,
        accessMode: 'READ_ONLY',
        reason: 'PAST_DUE',
      };
    }

    case 'CANCELED':
    default:
      return { ...base, accessMode: 'READ_ONLY', reason: 'CANCELED' };
  }
}
