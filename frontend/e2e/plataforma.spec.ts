import { expect, test } from "@playwright/test";
import { PASSWORD } from "./api";
import { trackPageErrors } from "./helpers";
import { STATE } from "./session";

test("quem é da plataforma e não tem loja entra direto na área dela", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "admin@plataforma.com");
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/plataforma\/organizacoes/, { timeout: 20_000 });
  // A lista é paginada e cada rodada do teste de cadastro cria mais uma organização: busca pelo
  // nome para a do seed não sair da primeira página.
  await page.getByLabel("Buscar organizações").fill("Distribuidora Exemplo");
  await expect(page.getByText("Distribuidora Exemplo").first()).toBeVisible();
});

test.describe("área da plataforma", () => {
  test.use({ storageState: STATE.admin });

  test("organizações: ajusta a assinatura e volta ao normal", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/plataforma/organizacoes");
    await page.getByPlaceholder(/Nome da organização/).fill("Distribuidora Exemplo");
    await page
      .getByRole("row", { name: /Distribuidora Exemplo/ })
      .getByRole("link", { name: "Abrir" })
      .click();
    await page.waitForURL(/\/organizacoes\//);

    await page.getByLabel("Situação").click();
    await page.getByRole("option", { name: "Pagamento em atraso" }).click();
    await page.getByRole("button", { name: "Salvar ajuste" }).click();
    await expect(page.getByText("Assinatura ajustada.")).toBeVisible();
    // a data de atraso é preenchida sozinha ao entrar em atraso
    await expect(page.locator("dl")).toContainText(/Em atraso desde\s*\d{2}\/\d{2}\/\d{4}/);

    await page.getByLabel("Situação").click();
    await page.getByRole("option", { name: "Em teste" }).click();
    await page.getByRole("button", { name: "Salvar ajuste" }).click();
    await expect(page.getByText("Assinatura ajustada.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("planos: cria e exclui", async ({ page }) => {
    await page.goto("/plataforma/planos");
    await page.getByRole("button", { name: "Novo plano" }).click();
    await page.getByLabel("Nome do plano").fill(`Plano E2E ${Date.now() % 100000}`);
    await page.getByLabel("Preço por mês").fill("49,9");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Plano criado.")).toBeVisible();

    await page.getByRole("button", { name: /Excluir Plano E2E/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir plano" }).click();
    await expect(page.getByText("Plano excluído.")).toBeVisible();
  });

  test("usuários: não deixa desativar a si mesmo", async ({ page }) => {
    await page.goto("/plataforma/usuarios");
    await page.getByPlaceholder("Nome ou e-mail").fill("admin@plataforma");
    await page.getByRole("button", { name: "Desativar" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByText("Você não pode desativar o próprio usuário.")).toBeVisible();
  });

  test("notificações: cria e aparece no sino", async ({ page }) => {
    await page.goto("/plataforma/notificacoes");
    const titulo = `Aviso E2E ${Date.now() % 100000}`;
    await page.getByRole("button", { name: "Nova notificação" }).click();
    await page.getByLabel("Título").fill(titulo);
    await page.getByLabel("Mensagem").fill("Mensagem de teste.");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notificação criada.")).toBeVisible();

    await page.getByRole("button", { name: "Notificações" }).click();
    await expect(page.getByText(titulo).first()).toBeVisible();
    await page.getByRole("button", { name: "Marcar como lida" }).first().click();
  });
});
