import { expect, test } from "@playwright/test";
import { backend, PASSWORD, signupByApi } from "./api";
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
    // a primeira lista é o resumo (a segunda é a da indicação)
    await expect(page.locator("dl").first()).toContainText(
      /Em atraso desde\s*\d{2}\/\d{2}\/\d{4}/,
    );

    await page.getByLabel("Situação").click();
    await page.getByRole("option", { name: "Em teste" }).click();
    await page.getByRole("button", { name: "Salvar ajuste" }).click();
    await expect(page.getByText("Assinatura ajustada.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("conta isenta: vitalícia com o plano combinado; o dono não troca de plano", async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    const name = `Parceira E2E ${Date.now() % 100000}`;
    const org = await signupByApi(name);

    await page.goto("/plataforma/organizacoes");
    await page.getByPlaceholder(/Nome da organização/).fill(name);
    await page.getByRole("row", { name: new RegExp(name) }).getByRole("link", { name: "Abrir" }).click();
    await page.waitForURL(/\/organizacoes\//);

    await page.getByLabel("Situação").click();
    await page.getByRole("option", { name: "Isenta" }).click();
    await page.getByLabel("Plano").click();
    await page.getByRole("option", { name: "Básico" }).click();
    // sem data limite e sem vitalícia, não salva
    await expect(
      page.getByText("Escolha a data limite da isenção ou marque Vitalícia."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar ajuste" })).toBeDisabled();
    await page.getByRole("checkbox", { name: "Acesso vitalício (sem data limite)" }).click();
    await expect(page.getByLabel("Isenta até")).toBeDisabled();
    await page.getByLabel("Motivo (só a plataforma vê)").fill("Parceiro E2E");
    await page.getByRole("button", { name: "Salvar ajuste" }).click();
    await expect(page.getByText("Assinatura ajustada.")).toBeVisible();
    await expect(page.locator("dl").first()).toContainText("Isenta (vitalícia) · Parceiro E2E");

    // o dono vê a conta isenta, com o plano combinado, e não consegue trocar de plano sozinho
    const [mine] = await backend<
      { subscriptionStatus: string; exemptUntil: string | null; plan: { name: string } }[]
    >("GET", "/organizations/mine", { token: org.token });
    expect(mine).toMatchObject({
      subscriptionStatus: "EXEMPT",
      exemptUntil: null,
      plan: { name: "Básico" },
    });
    const plans = await backend<{ id: string; name: string }[]>("GET", "/plans");
    const rede = plans.find((p) => p.name === "Rede")!;
    await expect(
      backend("PATCH", `/organizations/${org.id}/plan`, {
        token: org.token,
        body: { planId: rede.id },
      }),
    ).rejects.toThrow(/isenta de mensalidade/);
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

  test("notificações: o usuário marca todas como lidas de uma vez", async ({ page, browser }) => {
    // duas notificações novas, ainda não lidas por ninguém
    await page.goto("/plataforma/notificacoes");
    for (const n of [1, 2]) {
      await page.getByRole("button", { name: "Nova notificação" }).click();
      await page.getByLabel("Título").fill(`Todas lidas E2E ${n}`);
      await page.getByLabel("Mensagem").fill("Mensagem de teste.");
      await page.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByText("Notificação criada.").last()).toBeVisible();
    }

    const context = await browser.newContext({ storageState: STATE.funcionario });
    const user = await context.newPage();
    await user.goto("/notificacoes");
    const markAll = user.getByRole("button", { name: "Marcar todas como lidas" });
    await markAll.click();
    await expect(user.getByText("Todas as notificações foram marcadas como lidas.")).toBeVisible();
    await expect(markAll).toHaveCount(0);
    await expect(user.getByRole("button", { name: "Marcar como lida" })).toHaveCount(0);

    // no sino, o contador some e o botão também
    await user.getByRole("button", { name: "Notificações" }).click();
    await expect(user.getByText("Todas lidas E2E 2").first()).toBeVisible();
    await expect(user.getByRole("button", { name: "Marcar todas como lidas" })).toHaveCount(0);
    await context.close();
  });

  test("enquete: a plataforma cria com prazo, o atendente vota, vê o resultado e muda o voto", async ({
    page,
    browser,
  }) => {
    const titulo = `Enquete E2E ${Date.now() % 100000}`;
    const amanha = new Date(Date.now() + 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const prazo = `${amanha.getFullYear()}-${pad(amanha.getMonth() + 1)}-${pad(amanha.getDate())}T18:00`;

    await page.goto("/plataforma/notificacoes");
    await page.getByRole("button", { name: "Nova notificação" }).click();
    await page.getByLabel("Título").fill(titulo);
    await page.getByLabel("Mensagem").fill("Qual recurso você quer primeiro?");
    await page.getByLabel("Tipo").click();
    await page.getByRole("option", { name: "Enquete" }).click();
    // sem prazo e com uma opção só, não salva
    // exact: "Opção 3" também casaria com o botão "Remover opção 3"
    const opcao = (n: number) => page.getByLabel(`Opção ${n}`, { exact: true });
    await opcao(1).fill("Nota fiscal");
    await expect(page.getByText("Preencha pelo menos 2 opções.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await opcao(2).fill("Delivery");
    await page.getByRole("button", { name: "Adicionar opção" }).click();
    await opcao(3).fill("Relatórios");
    await expect(page.getByText("Informe o prazo para votar.")).toBeVisible();
    await page.getByLabel("Prazo para votar").fill(prazo);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notificação criada.")).toBeVisible();

    const context = await browser.newContext({ storageState: STATE.funcionario });
    const user = await context.newPage();
    await user.goto("/notificacoes");
    const enquete = user.locator("article", { hasText: titulo });
    await expect(enquete.getByText("Escolha uma opção")).toBeVisible();
    // antes de votar, nada de resultado
    await expect(enquete.getByText(/pessoas? votou|pessoas votaram/)).toHaveCount(0);
    await enquete.getByLabel("Delivery").check();
    await enquete.getByRole("button", { name: "Votar" }).click();
    await expect(user.getByText("Voto registrado.")).toBeVisible();
    await expect(enquete.getByText("1 pessoa votou")).toBeVisible();
    await expect(enquete.getByText("1 voto · 100%")).toBeVisible();

    await enquete.getByRole("button", { name: "Mudar voto" }).click();
    await enquete.getByLabel("Nota fiscal").check();
    await enquete.getByRole("button", { name: "Salvar voto" }).click();
    await expect(user.getByText("Voto alterado.")).toBeVisible();
    await expect(enquete.getByText("1 pessoa votou")).toBeVisible();
    await context.close();

    // a plataforma vê o resultado parcial, e as opções ficam travadas
    await page.reload();
    const naLista = page.locator("article", { hasText: titulo });
    await expect(naLista.getByText("1 pessoa votou")).toBeVisible();
    await naLista.getByRole("button", { name: "Editar" }).click();
    await expect(opcao(1)).toBeDisabled();
    await expect(
      page.getByText("A enquete já recebeu votos: as opções não mudam mais."),
    ).toBeVisible();
  });
});
