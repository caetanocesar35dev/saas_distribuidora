import type { OrganizationSummary, Plan } from "@/lib/api/types";
import { formatInt } from "@/lib/format";

/** Resumo dos limites do plano (ex.: "1 empresa · até 3 lojas"). */
export function planLimits(plan: Pick<Plan, "maxCompanies" | "maxStoresPerCompany">): string {
  const companies =
    plan.maxCompanies === null
      ? "empresas ilimitadas"
      : `${formatInt(plan.maxCompanies)} ${plan.maxCompanies === 1 ? "empresa" : "empresas"}`;
  const stores =
    plan.maxStoresPerCompany === null
      ? "lojas ilimitadas"
      : plan.maxStoresPerCompany === 1
        ? "1 loja por empresa"
        : `até ${formatInt(plan.maxStoresPerCompany)} lojas por empresa`;
  return `${companies} · ${stores}`;
}

/**
 * O que a organização usa hoje cabe no plano? Mesma conta do backend (que confere de novo): o
 * downgrade é recusado se houver mais empresas, ou uma empresa com mais lojas, que o plano permite.
 * Devolve o motivo em texto quando não cabe.
 */
export function planFit(
  plan: Pick<Plan, "maxCompanies" | "maxStoresPerCompany">,
  companies: OrganizationSummary["companies"],
): string | null {
  if (plan.maxCompanies !== null && companies.length > plan.maxCompanies) {
    return `Permite ${formatInt(plan.maxCompanies)} empresa(s) e você tem ${formatInt(companies.length)}.`;
  }
  if (plan.maxStoresPerCompany !== null) {
    const max = plan.maxStoresPerCompany;
    const over = companies.find((c) => c.storeCount > max);
    if (over) {
      return `Permite ${formatInt(max)} loja(s) por empresa e ${over.nomeFantasia || over.razaoSocial} tem ${formatInt(over.storeCount)}.`;
    }
  }
  return null;
}

/**
 * Planos que o dono pode escolher na troca: só os pagos (o gratuito é o do período de teste,
 * decisão do usuário), do mais barato ao mais caro.
 */
export function choosablePlans(plans: Plan[]): Plan[] {
  return plans.filter((p) => p.priceInCents > 0).sort((a, b) => a.priceInCents - b.priceInCents);
}
