import { BadRequestException } from '@nestjs/common';
import { PrismaTx } from '../prisma/prisma.extension';
import {
  commissionInCents,
  isValidReferralCode,
  normalizeReferralCode,
  REFERRAL_DISCOUNT_MONTHS,
  REFERRAL_DISCOUNT_PERCENT,
  REFERRAL_MAX_MONTHS,
  referrerMonthsToGrant,
  remainingMonths,
} from './referral-rules';

export type ReferralSource =
  | { kind: 'ORGANIZATION'; code: string; organizationId: string }
  | { kind: 'REPRESENTATIVE'; code: string; representativeId: string };

const NOT_FOUND = 'Código de indicação não encontrado.';

/** Acha quem é dono do código (cliente ou representante ativo). Código desconhecido → 400. */
export async function resolveReferralCode(
  db: PrismaTx,
  raw: string,
): Promise<ReferralSource> {
  const code = normalizeReferralCode(raw);
  if (!isValidReferralCode(code)) throw new BadRequestException(NOT_FOUND);
  const org = await db.organization.findFirst({
    where: { referralCode: code },
    select: { id: true },
  });
  if (org) return { kind: 'ORGANIZATION', code, organizationId: org.id };
  const rep = await db.salesRepresentative.findFirst({
    where: { code },
    select: { id: true },
  });
  if (rep) return { kind: 'REPRESENTATIVE', code, representativeId: rep.id };
  throw new BadRequestException(NOT_FOUND);
}

/**
 * O código já é de alguém (cliente ou representante, inclusive excluídos: o índice único vale para
 * todos). SQL direto porque a extensão esconderia os excluídos.
 */
export async function isReferralCodeTaken(
  db: PrismaTx,
  code: string,
  exceptRepresentativeId?: string,
): Promise<boolean> {
  const rows = await db.$queryRaw<{ found: number }[]>`
    SELECT 1 AS found FROM "tb_organizations" WHERE "referralCode" = ${code}
    UNION ALL
    SELECT 1 AS found FROM "tb_sales_representatives"
      WHERE "code" = ${code} AND "id" <> ${exceptRepresentativeId ?? ''}
    LIMIT 1`;
  return rows.length > 0;
}

/**
 * Cadastro com código: grava a indicação (pendente) e o desconto de quem se cadastrou, que já
 * aparece para ele e vale nas mensalidades depois do trial.
 */
export async function registerSignupReferral(
  tx: PrismaTx,
  referredOrganizationId: string,
  source: ReferralSource,
) {
  const referral = await tx.referral.create({
    data: {
      code: source.code,
      referredOrganizationId,
      ...(source.kind === 'ORGANIZATION'
        ? { referrerOrganizationId: source.organizationId }
        : { representativeId: source.representativeId }),
    },
  });
  await tx.subscriptionDiscount.create({
    data: {
      organizationId: referredOrganizationId,
      referralId: referral.id,
      reason: 'REFERRED',
      percent: REFERRAL_DISCOUNT_PERCENT,
      months: REFERRAL_DISCOUNT_MONTHS,
    },
  });
  return referral;
}

/**
 * O indicado pagou a 1ª mensalidade: a indicação pendente vira confirmada e libera a recompensa de
 * quem indicou. Cliente: desconto, até o limite acumulado. Representante: comissão de
 * `commissionPercent` % do preço do plano atual do indicado, a pagar por Pix.
 * Sem indicação pendente, não faz nada (chamar de novo é seguro).
 *
 * Hoje é chamado quando a plataforma muda a assinatura para ACTIVE; na Fase 10, pelo webhook do
 * pagamento confirmado.
 */
export async function confirmReferral(
  tx: PrismaTx,
  referredOrganizationId: string,
) {
  const referral = await tx.referral.findFirst({
    where: { referredOrganizationId, status: 'PENDING' },
    select: {
      id: true,
      referrerOrganizationId: true,
      representative: { select: { commissionPercent: true } },
      referredOrganization: {
        select: { plan: { select: { id: true, priceInCents: true } } },
      },
    },
  });
  if (!referral) return null;

  const plan = referral.referredOrganization.plan;
  let note: string | undefined;

  if (referral.referrerOrganizationId) {
    const referrerId = referral.referrerOrganizationId;
    // Duas confirmações ao mesmo tempo não passam juntas do limite acumulado.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'referral-discounts:' + referrerId}))`;
    const current = await tx.subscriptionDiscount.findMany({
      where: { organizationId: referrerId },
      select: { months: true, monthsUsed: true },
    });
    const months = referrerMonthsToGrant(remainingMonths(current));
    if (months > 0) {
      await tx.subscriptionDiscount.create({
        data: {
          organizationId: referrerId,
          referralId: referral.id,
          reason: 'REFERRER',
          percent: REFERRAL_DISCOUNT_PERCENT,
          months,
        },
      });
    } else {
      note = `Quem indicou já tinha ${REFERRAL_MAX_MONTHS} meses de desconto acumulados (o limite).`;
    }
  }

  return tx.referral.update({
    where: { id: referral.id },
    data: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      confirmedPlanId: plan.id,
      confirmedPlanPriceInCents: plan.priceInCents,
      ...(referral.representative
        ? {
            commissionInCents: commissionInCents(
              plan.priceInCents,
              referral.representative.commissionPercent,
            ),
          }
        : {}),
      ...(note ? { note } : {}),
    },
  });
}
