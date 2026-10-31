import { expect, test } from "@playwright/test";
import { backend, seedCompany } from "./api";
import { accessTokenOf, STATE } from "./session";

interface PlanRow {
  id: string;
  name: string;
  priceInCents: number;
}
interface OrgRow {
  id: string;
  plan: { id: string };
}

test.describe("troca de plano pelo dono", () => {
  test.use({ storageState: STATE.dono });

  test("upgrade vale na hora; downgrade que não cabe fica apagado com o motivo", async ({
    page,
  }) => {
    const company = await seedCompany();
    const orgs = await backend<OrgRow[]>("GET", "/organizations/mine", { token: company.token });
    const originalPlanId = orgs.find((o) => o.id === company.organizationId)!.plan.id;
    const plans = await backend<PlanRow[]>("GET", "/plans");
    const basico = plans.find((p) => p.name === "Básico");
    test.skip(!basico, "Rode o seed para criar os planos (npm run db:seed).");

    try {
      await page.goto(`/empresa/${company.companyId}/assinatura`);
      await expect(page.getByRole("heading", { name: "Planos" })).toBeVisible();
      // o plano gratuito (o do teste) não é oferecido na troca
      await expect(page.getByRole("listitem").filter({ hasText: /^Trial/ })).toHaveCount(0);

      // a empresa do seed tem 2 lojas: o Essencial (1 loja) não cabe
      const essencial = page.getByRole("listitem").filter({ hasText: "Essencial" });
      await expect(essencial.getByRole("button")).toBeDisabled();
      await expect(essencial.getByText(/Permite 1 loja\(s\) por empresa/)).toBeVisible();

      const card = page.getByRole("listitem").filter({ hasText: "Básico" });
      await card.getByRole("button").click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Mudar de plano" }).click();
      await expect(page.getByText("Plano alterado para Básico.")).toBeVisible();
      await expect(card.getByText("Seu plano")).toBeVisible();
    } finally {
      // volta ao plano de antes (pela plataforma, que pode pôr de volta no Trial)
      await backend("PATCH", `/platform/organizations/${company.organizationId}`, {
        token: accessTokenOf("admin"),
        body: { planId: originalPlanId },
      });
    }
  });
});
