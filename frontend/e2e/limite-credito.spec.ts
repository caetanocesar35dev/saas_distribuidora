import { expect, test, type Page } from "@playwright/test";
import { backend, seedCompany } from "./api";
import { ensureCashOpen, goToStore, openStore, trackPageErrors } from "./helpers";
import { accessTokenOf, STATE } from "./session";

/** Põe uma Água Mineral (R$ 2,50) no carrinho e escolhe fiado para o cliente. */
async function fiadoDeAgua(page: Page, storeId: string, nome: string) {
  await goToStore(page, storeId, "/pdv");
  await page.getByPlaceholder(/Passe o leitor/).fill("Água");
  await page.locator("ul button", { hasText: "Água Mineral" }).first().click();
  await page.getByRole("button", { name: /Finalizar venda/ }).click();
  const checkout = page.getByRole("dialog");
  await checkout.getByRole("button", { name: "Fiado", exact: true }).click();
  await checkout.getByRole("button", { name: /Escolher cliente/ }).click();
  await page.getByLabel("Buscar cliente").fill(nome);
  await page
    .getByRole("button", { name: new RegExp(nome) })
    .first()
    .click();
  await checkout.getByRole("button", { name: "Concluir", exact: true }).click();
  return checkout;
}

test.describe("limite de crédito no fiado", () => {
  test("dono define o limite no cadastro e confirma a venda acima dele", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STATE.dono });
    const page = await context.newPage();
    const errors = trackPageErrors(page);
    const storeId = await openStore(page, "Loja Centro");
    await ensureCashOpen(page, storeId);

    // cadastro com limite de R$ 3,00
    const nome = `Limite E2E ${Date.now() % 100000}`;
    await goToStore(page, storeId, "/clientes");
    await page.getByRole("button", { name: "Novo cliente" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(nome);
    await page.getByLabel(/Limite de crédito no fiado/).fill("3,00");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Cliente cadastrado.")).toBeVisible();

    // 1ª venda: R$ 2,50, dentro do limite e sem dívida -> vende direto
    await fiadoDeAgua(page, storeId, nome);
    await expect(page.getByText("Venda concluída")).toBeVisible();
    await page.getByRole("button", { name: "Nova venda" }).click();

    // 2ª venda: a dívida iria para R$ 5,00 -> aviso de limite; o dono confirma
    await fiadoDeAgua(page, storeId, nome);
    const aviso = page.getByRole("alertdialog");
    await expect(aviso.getByText("Venda acima do limite de crédito")).toBeVisible();
    await expect(aviso).toContainText(/limite de crédito do cliente é\s*R\$\s*3,00/);
    await expect(aviso).toContainText(/passa para\s*R\$\s*5,00/);
    await aviso.getByRole("button", { name: "Sim, vender acima do limite" }).click();
    await expect(page.getByText("Venda concluída")).toBeVisible();

    // o detalhe do cliente mostra o limite estourado
    await goToStore(page, storeId, "/clientes");
    await page.getByPlaceholder("Buscar por nome ou telefone").fill(nome);
    await page
      .getByRole("row", { name: new RegExp(nome) })
      .getByRole("link", { name: "Abrir" })
      .click();
    await expect(page.getByText(/Passou do limite em\s*R\$\s*2,00/)).toBeVisible();

    expect(errors).toEqual([]);
    await context.close();
  });

  test("atendente é barrado na tela e na API acima do limite", async ({ browser }) => {
    // cliente com limite de R$ 1,00, criado pelo dono
    const { token, companyId } = await seedCompany();
    const nome = `Limite Atendente ${Date.now() % 100000}`;
    const customer = await backend<{ id: string }>("POST", `/companies/${companyId}/customers`, {
      token,
      body: { name: nome, creditLimit: 1 },
    });

    const context = await browser.newContext({ storageState: STATE.funcionario });
    const page = await context.newPage();
    const storeId = await openStore(page, "Loja Norte");
    await ensureCashOpen(page, storeId);

    const checkout = await fiadoDeAgua(page, storeId, nome);
    const aviso = page.getByRole("alertdialog");
    await expect(aviso.getByText("Venda acima do limite de crédito")).toBeVisible();
    await expect(aviso).toContainText("Só gerente ou dono pode vender no fiado acima do limite");
    await expect(aviso.getByRole("button", { name: /Sim/ })).toHaveCount(0);
    await aviso.getByRole("button", { name: "Entendi" }).click();
    await expect(checkout).toBeVisible();
    await expect(page.getByText("Venda concluída")).toBeHidden();

    // a API também recusa, mesmo pedindo para passar do limite
    const products = await backend<{ data: { id: string; product: { name: string } }[] }>(
      "GET",
      `/stores/${storeId}/store-products?search=Água`,
      { token: accessTokenOf("funcionario") },
    );
    await expect(
      backend("POST", `/stores/${storeId}/sales`, {
        token: accessTokenOf("funcionario"),
        body: {
          paymentMethod: "CREDIT_STORE",
          customerId: customer.id,
          items: [{ storeProductId: products.data[0].id, quantity: 1 }],
          allowOverCreditLimit: true,
        },
      }),
    ).rejects.toThrow(/403/);

    // e o atendente não consegue mudar o limite
    await expect(
      backend("PATCH", `/companies/${companyId}/customers/${customer.id}`, {
        token: accessTokenOf("funcionario"),
        body: { creditLimit: 1000 },
      }),
    ).rejects.toThrow(/403/);
    await context.close();
  });
});
