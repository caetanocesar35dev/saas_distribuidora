import { expect, test } from "@playwright/test";
import { seedCompany, setSubscription } from "./api";
import { ensureCashOpen, goToStore, openStore } from "./helpers";
import { STATE } from "./session";

test.describe("assinatura vencida: modo somente leitura", () => {
  test.use({ storageState: STATE.dono });

  test("tudo pode ser consultado, só o caixa aberto pode ser fechado, e o backend recusa escritas", async ({
    page,
  }) => {
    const company = await seedCompany();
    const storeId = await openStore(page, "Loja Centro");
    // o caixa precisa estar aberto antes de a assinatura vencer
    await ensureCashOpen(page, storeId);

    await setSubscription(company.organizationId, "CANCELED");
    try {
      await page.reload();
      await expect(page.getByText("Sistema somente para consulta").first()).toBeVisible();

      await goToStore(page, storeId, "/pdv");
      await expect(page.getByRole("button", { name: /Finalizar venda/ })).toBeDisabled();

      await goToStore(page, storeId, "/caixa");
      await expect(page.getByRole("button", { name: "Fechar caixa" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Entrada de dinheiro" })).toBeDisabled();

      await goToStore(page, storeId, "/clientes");
      await page.getByRole("link", { name: "Abrir" }).first().click();
      await page.waitForURL(/\/clientes\//);
      await expect(page.getByRole("button", { name: "Receber pagamento" })).toBeDisabled();

      await goToStore(page, storeId, "/estoque");
      await expect(page.getByRole("button", { name: "Entrada" }).first()).toBeDisabled();

      const result = await page.evaluate(async (id) => {
        const res = await fetch(`/api/stores/${id}/cash-register/movements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "IN", amount: 1 }),
        });
        return { status: res.status, body: await res.json() };
      }, storeId);
      expect(result.status).toBe(402);
      expect(result.body.code).toBe("SUBSCRIPTION_READ_ONLY");
    } finally {
      await setSubscription(company.organizationId, "TRIAL");
    }

    // regularizada: o acesso completo volta
    await page.reload();
    await expect(page.getByText("Sistema somente para consulta")).toHaveCount(0);
    await goToStore(page, storeId, "/caixa");
    await expect(page.getByRole("button", { name: "Entrada de dinheiro" })).toBeEnabled();
  });

  test("durante o teste grátis aparece a faixa com os dias que faltam", async ({ page }) => {
    await openStore(page);
    await expect(page.getByText(/Seu período de teste termina em/).first()).toBeVisible();
  });
});
