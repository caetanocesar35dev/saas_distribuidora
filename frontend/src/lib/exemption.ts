import type { UpdateOrganizationBody } from "@/lib/api/types";
import { dayEndIso, formatDate } from "@/lib/format";

/**
 * Conta isenta de mensalidade (decidido pelo usuário, 2026-11-22): a plataforma escolhe uma data
 * limite ou marca "Vitalícia" (sem data). Aqui fica o que o formulário de ajuste manda à API.
 */
export interface ExemptionForm {
  lifetime: boolean;
  /** Dia limite (AAAA-MM-DD); ignorado quando é vitalícia. */
  until: string;
  reason: string;
}

/** O que mudou na isenção (só quando a situação escolhida é Isenta), ou o erro que impede salvar. */
export function exemptionChanges(
  form: ExemptionForm,
  current: { wasExempt: boolean; exemptUntil: string | null; exemptReason: string | null },
  today: string,
): { body: Pick<UpdateOrganizationBody, "exemptUntil" | "exemptReason">; error: string | null } {
  if (!form.lifetime && !form.until)
    return { body: {}, error: "Escolha a data limite da isenção ou marque Vitalícia." };
  if (!form.lifetime && form.until <= today)
    return { body: {}, error: "A data limite da isenção precisa ser depois de hoje." };

  const until = form.lifetime ? null : dayEndIso(form.until);
  const reason = form.reason.trim() || null;
  const body: Pick<UpdateOrganizationBody, "exemptUntil" | "exemptReason"> = {};
  const sameUntil =
    current.wasExempt &&
    (until === null
      ? current.exemptUntil === null
      : current.exemptUntil !== null &&
        new Date(current.exemptUntil).getTime() === new Date(until).getTime());
  if (!current.wasExempt || !sameUntil) body.exemptUntil = until;
  if (!current.wasExempt ? reason !== null : reason !== current.exemptReason)
    body.exemptReason = reason;
  return { body, error: null };
}

/** "Isenta até 22/11/2027" ou "Isenta (vitalícia)". */
export function exemptionLabel(exemptUntil: string | null): string {
  return exemptUntil ? `Isenta até ${formatDate(exemptUntil)}` : "Isenta (vitalícia)";
}
