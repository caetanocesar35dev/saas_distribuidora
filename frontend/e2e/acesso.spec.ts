import { expect, test } from "@playwright/test";
import { loginPelaTela, trackPageErrors } from "./helpers";
import { STATE } from "./session";

test.describe("login e sair", () => {
  test("senha errada mostra a mensagem do sistema e não entra", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", `ninguem${Date.now()}@exemplo-teste.com`);
    await page.fill("#password", "senha-errada");
    await page.click("button[type=submit]");
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("os campos são validados antes de enviar", async ({ page }) => {
    await page.goto("/login");
    await page.click("button[type=submit]");
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    await expect(page.getByText("Informe a senha.")).toBeVisible();
  });

  test("área logada sem sessão volta ao login guardando para onde ir", async ({ page }) => {
    await page.goto("/loja/qualquer-id/pdv");
    await expect(page).toHaveURL(/\/login\?next=%2Floja%2Fqualquer-id%2Fpdv/);
  });

  test("entrar, trocar de loja e sair", async ({ page }) => {
    const errors = trackPageErrors(page);
    await loginPelaTela(page, "dono@exemplo.com", "Loja Centro");

    await page.getByRole("button", { name: /Loja Centro/ }).first().click();
    await page.getByRole("menuitem", { name: /Loja Norte/ }).click();
    await expect(page.getByRole("button", { name: /Loja Norte/ }).first()).toBeVisible();

    await page.getByRole("button", { name: "Menu do usuário" }).click();
    await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
    await page.waitForURL(/\/login/);

    await page.goto("/selecionar");
    await expect(page).toHaveURL(/\/login/);
    expect(errors).toEqual([]);
  });

  test("a renovação da sessão é transparente: sem o access token a página continua funcionando", async ({
    page,
    context,
  }) => {
    // sessão própria (a renovação troca o refresh token, então não pode ser a compartilhada)
    await loginPelaTela(page, "funcionario@exemplo.com", "Loja Norte");
    const cookies = await context.cookies();
    await context.clearCookies();
    await context.addCookies(cookies.filter((c) => c.name !== "sd_at"));

    const statuses = await page.evaluate(async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => fetch("/api/me/memberships")),
      );
      return responses.map((r) => r.status);
    });
    expect(statuses).toEqual([200, 200, 200, 200, 200]);

    await page.reload();
    await expect(page.getByRole("button", { name: /Loja/ }).first()).toBeVisible();
  });
});

test.describe("segurança da sessão", () => {
  test.use({ storageState: STATE.dono });

  test("os tokens ficam em cookies httpOnly e a página nunca os enxerga", async ({ page, context }) => {
    await page.goto("/selecionar?trocar=1");
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "sd_at")?.httpOnly).toBe(true);
    expect(cookies.find((c) => c.name === "sd_rt")?.httpOnly).toBe(true);

    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain("sd_at");
    expect(visible).not.toContain("sd_rt");
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toMatch(/eyJ/);
  });

  test("o navegador não consegue chamar a renovação nem enviar escrita de outro site", async ({
    page,
    request,
  }) => {
    await page.goto("/selecionar?trocar=1");
    const refresh = await page.evaluate(
      async () =>
        (
          await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: "x" }),
          })
        ).status,
    );
    expect(refresh).toBe(404);

    const foreign = await request.post("/api/auth/forgot-password", {
      headers: { Origin: "https://site-malicioso.com" },
      data: { email: "a@b.com" },
    });
    expect(foreign.status()).toBe(403);
  });
});

test.describe("recuperar a senha e ajuda", () => {
  test("esqueci a senha responde sempre igual e o link sem token avisa", async ({ page }) => {
    await page.goto("/esqueci-a-senha");
    await page.getByLabel("E-mail").fill(`ninguem${Date.now()}@exemplo-teste.com`);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText(/Se o e-mail estiver cadastrado/)).toBeVisible();

    await page.goto("/redefinir-senha");
    await expect(page.getByText("Link incompleto")).toBeVisible();

    await page.goto("/redefinir-senha?token=invalido");
    await page.getByLabel("Nova senha", { exact: true }).fill("senha12345");
    await page.getByLabel("Repita a nova senha").fill("senha12345");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByText("Link inválido ou expirado.")).toBeVisible();
  });

  test("Central de Dúvidas abre sem login e a busca acha em todos os perfis", async ({ page }) => {
    await page.goto("/duvidas");
    await page.getByPlaceholder(/Busque por uma palavra/).fill("sangria");
    await page.getByRole("link", { name: /Sangria: tirar dinheiro do caixa/ }).click();
    await expect(page.getByText("Onde encontrar")).toBeVisible();
    await expect(page.getByText("Menu › Caixa › Caixa atual › Saída (sangria)")).toBeVisible();
  });
});
