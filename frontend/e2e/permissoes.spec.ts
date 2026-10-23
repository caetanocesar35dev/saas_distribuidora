import { expect, test } from "@playwright/test";
import { seedCompany } from "./api";
import { ensureCashOpen, goToStore, openStore } from "./helpers";
import { STATE } from "./session";

test.describe("atendente", () => {
  test.use({ storageState: STATE.funcionario });

  test("sem Produtos, sem custo, sem painel da empresa", async ({ page }) => {
    const storeId = await openStore(page, "Loja Norte");
    await goToStore(page, storeId, "/estoque");

    const menu = await page.locator("aside").innerText();
    expect(menu).not.toContain("Produtos");
    expect(menu).not.toContain("Painel da empresa");
    expect(await page.locator("thead").innerText()).not.toContain("Custo");
    await expect(page.getByText("Colocar produto na loja")).toHaveCount(0);

    await goToStore(page, storeId, "/produtos");
    await expect(page.getByText("Você não tem permissão para ver esta página")).toBeVisible();
  });

  test("não vê o lucro nas vendas nem a sangria no caixa", async ({ page }) => {
    const storeId = await openStore(page, "Loja Norte");
    await goToStore(page, storeId, "/vendas");
    await expect(page.getByText("Faturamento (vendas concluídas)")).toBeVisible();
    await expect(page.getByText("Lucro", { exact: true })).toHaveCount(0);

    await ensureCashOpen(page, storeId);
    await expect(page.getByRole("button", { name: /Saída \(sangria\)/ })).toHaveCount(0);
  });

  test("vê a dívida da loja na lista de clientes, mas não a dívida total", async ({ page }) => {
    const storeId = await openStore(page, "Loja Norte");
    await goToStore(page, storeId, "/clientes");
    await expect(page.getByRole("columnheader", { name: "Dívida nesta loja" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Dívida total" })).toHaveCount(0);
  });
});

test.describe("gerente", () => {
  test.use({ storageState: STATE.gerente });

  test("vê Produtos, painel da loja e sangria, mas não a empresa", async ({ page }) => {
    // gerente de uma loja só: a seleção já o leva direto para ela
    await page.goto("/selecionar?trocar=1");
    await page.getByRole("link", { name: /Loja Centro/ }).first().click();
    await page.waitForURL(/\/loja\/([0-9a-f-]+)/);
    const storeId = page.url().match(/\/loja\/([0-9a-f-]+)/)![1];
    await goToStore(page, storeId);

    const menu = await page.locator("aside").innerText();
    expect(menu).toContain("Produtos");
    expect(menu).not.toContain("Painel da empresa");
    await expect(page.getByText("Faturamento").first()).toBeVisible();

    await ensureCashOpen(page, storeId);
    await expect(page.getByRole("button", { name: /Saída \(sangria\)/ })).toBeVisible();

    const company = await seedCompany();
    await page.goto(`/empresa/${company.companyId}/equipe`);
    await expect(page.getByText("Você não tem permissão para ver esta página")).toBeVisible();

    // o backend também recusa: esconder botão é só UX
    const status = await page.evaluate(
      async (id) => (await fetch(`/api/companies/${id}/members`)).status,
      company.companyId,
    );
    expect(status).toBe(403);
  });
});

test.describe("dono", () => {
  test.use({ storageState: STATE.dono });

  test("abre a empresa e a equipe lista todos", async ({ page }) => {
    const storeId = await openStore(page, "Loja Centro");
    await goToStore(page, storeId);
    await page.getByRole("link", { name: "Painel da empresa" }).first().click();
    await page.getByRole("link", { name: "Equipe" }).first().click();
    for (const nome of ["Ana Funcionária", "Carlos Gerente", "Maria Dona"]) {
      await expect(page.getByText(nome).first()).toBeVisible();
    }
    await page.getByRole("button", { name: "Convidar pessoa" }).click();
    await expect(page.getByRole("dialog").getByText("Em quais lojas e com qual papel?")).toBeVisible();
  });

  test("quem não é da plataforma é barrado em /plataforma (tela e API)", async ({ page }) => {
    await page.goto("/plataforma/organizacoes");
    await expect(page.getByText("Área restrita")).toBeVisible();
    const status = await page.evaluate(async () => (await fetch("/api/platform/organizations")).status);
    expect(status).toBe(403);
  });
});
