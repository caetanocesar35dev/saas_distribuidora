import { expect, test } from "@playwright/test";
import { trackPageErrors } from "./helpers";
import { STATE } from "./session";

test.describe("página de apresentação", () => {
  test("abre sem login, com planos pagos, cadastro e canais de contato", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // o Trial é só do período de teste: não aparece na vitrine
    const planos = page.locator("#planos");
    await expect(planos.getByRole("heading", { name: "Essencial" })).toBeVisible();
    await expect(planos.getByRole("heading", { name: "Trial" })).toHaveCount(0);

    await expect(page.getByRole("link", { name: "Falar no WhatsApp" }).first()).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/5531975623307\?text=/,
    );
    await expect(page.getByRole("link", { name: "Instagram" }).first()).toHaveAttribute(
      "href",
      "https://www.instagram.com/minhadistribuidoraonline_/",
    );

    await page.getByRole("link", { name: /Testar grátis por 14 dias/ }).click();
    await expect(page).toHaveURL(/\/cadastro$/);
    expect(errors).toEqual([]);
  });

  test("quem já está logado vai direto para o sistema", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STATE.dono });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).not.toHaveURL(/localhost:\d+\/$/);
    await context.close();
  });

  test("a Central de Dúvidas mostra os canais de contato", async ({ page }) => {
    await page.goto("/duvidas");
    await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/5531975623307/,
    );
    await page.goto("/duvidas/faq-falar-com-suporte");
    await expect(page.getByRole("link", { name: /Instagram/ })).toHaveAttribute(
      "href",
      "https://www.instagram.com/minhadistribuidoraonline_/",
    );
  });
});
