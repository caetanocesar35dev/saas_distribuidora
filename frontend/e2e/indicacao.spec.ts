import { expect, test } from "@playwright/test";
import { backend, seedCompany, setSubscription, signupByApi } from "./api";
import { trackPageErrors } from "./helpers";
import { STATE } from "./session";

interface Referral {
  code: string;
  remainingMonths: number;
}

test.describe("programa de indicação", () => {
  test("o link de indicação preenche o código no cadastro", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/cadastro?ref=distri-7k2");
    await expect(page.getByLabel("Código de indicação (opcional)")).toHaveValue("DISTRI-7K2");
    await context.close();
  });

  test("dono indica: indicação pendente até o indicado pagar, depois ganha o desconto", async ({
    browser,
  }) => {
    const owner = await browser.newContext({ storageState: STATE.dono });
    const page = await owner.newPage();
    const errors = trackPageErrors(page);
    const company = await seedCompany();

    // ---- Indique e ganhe: o código e o link para compartilhar
    await page.goto(`/loja/${company.stores[0].storeId}`);
    await page.getByRole("button", { name: "Menu do usuário" }).click();
    await page.getByRole("menuitem", { name: "Indique e ganhe" }).click();
    await expect(page.getByRole("heading", { name: "Indique e ganhe" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Compartilhar no WhatsApp/ })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/\?text=/,
    );

    const before = await backend<Referral>(
      "GET",
      `/organizations/${company.organizationId}/referral`,
      { token: company.token },
    );
    await expect(page.getByText(before.code, { exact: true })).toBeVisible();

    // ---- alguém se cadastra com o código: aparece como aguardando o pagamento
    const name = `Indicada ${Date.now() % 1_000_000}`;
    const referred = await signupByApi(name, before.code);
    await page.reload();
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row.getByText("Aguardando o 1º pagamento")).toBeVisible();

    // ---- a plataforma põe o indicado em "Ativa" (= pagou): a indicação é confirmada
    await setSubscription(referred.id, "ACTIVE");
    await page.reload();
    await expect(row.getByText("Confirmada")).toBeVisible();

    const after = await backend<Referral>(
      "GET",
      `/organizations/${company.organizationId}/referral`,
      { token: company.token },
    );
    expect(after.remainingMonths).toBe(Math.min(before.remainingMonths + 2, 12));

    // ---- o selo de desconto ao lado do sino
    await page.getByRole("button", { name: "Desconto na mensalidade" }).click();
    await expect(page.getByText(/meses? com 20% de desconto/).first()).toBeVisible();

    expect(errors).toEqual([]);
    await owner.close();
  });

  test("plataforma: representante, comissão pelo plano e Pix enviado", async ({ browser }) => {
    const admin = await browser.newContext({ storageState: STATE.admin });
    const page = await admin.newPage();
    const errors = trackPageErrors(page);
    const stamp = Date.now() % 1_000_000;
    const code = `E2E-${stamp}`;
    const repName = `Representante Teste ${stamp}`;

    // ---- cadastra o representante pela tela
    await page.goto("/plataforma/representantes");
    await page.getByRole("button", { name: "Novo representante" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill(repName);
    await dialog.getByLabel("Telefone (WhatsApp)").fill("81988887777");
    await dialog.getByLabel("Chave Pix").fill("representante@pix.com");
    await dialog.getByLabel("Código de indicação").fill(code);
    await dialog.getByLabel("Comissão (% do plano)").fill("10");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("row").filter({ hasText: repName })).toBeVisible();

    // ---- alguém se cadastra com o código dele e paga
    const name = `Via Representante ${stamp}`;
    const referred = await signupByApi(name, code);
    await setSubscription(referred.id, "ACTIVE");

    // ---- no painel: confirmada, comissão a pagar; marca o Pix
    await page.goto("/plataforma/indicacoes");
    await page.getByRole("textbox", { name: "Buscar indicações" }).fill(name);
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row.getByText("Confirmada")).toBeVisible();
    await expect(row.getByText(repName)).toBeVisible();
    await expect(row.getByText("A pagar")).toBeVisible();
    await row.getByRole("button", { name: "Pix enviado" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Pix enviado" }).click();
    await expect(page.getByText("Comissão marcada como paga.")).toBeVisible();
    await expect(row.getByText(/Pago em/)).toBeVisible();

    // ---- o detalhe da organização mostra quem indicou
    await row.getByRole("link", { name }).click();
    await expect(page.getByText(`${repName} (representante)`)).toBeVisible();

    // ---- limpa: o representante sai (o código deixa de valer)
    await page.goto("/plataforma/representantes");
    await page.getByRole("button", { name: `Excluir ${repName}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir representante" }).click();
    await expect(page.getByText("Representante excluído.")).toBeVisible();

    expect(errors).toEqual([]);
    await admin.close();
  });
});
