import { expect, test } from "@playwright/test";
import { ensureCashOpen, goToStore, openStore, trackPageErrors } from "./helpers";
import { STATE } from "./session";

test.describe("PDV, fiado, comandas e caixa", () => {
  test.use({ storageState: STATE.dono });

  test("venda com vasilhame, fiado, recebimento, comanda, cancelamento e histórico", async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    const storeId = await openStore(page, "Loja Centro");
    await ensureCashOpen(page, storeId);

    // ---- venda com vasilhame
    await goToStore(page, storeId, "/pdv");
    await page.getByPlaceholder(/Passe o leitor/).fill("Litr");
    await page.locator("ul button", { hasText: "Cerveja Litrão" }).first().click();
    await page.getByRole("button", { name: /Finalizar venda/ }).click();
    const checkout = page.getByRole("dialog");
    await expect(checkout.getByText("Vasilhames", { exact: true })).toBeVisible();

    const concluir = checkout.getByRole("button", { name: "Concluir", exact: true });
    await expect(concluir, "sai devendo vasilhame sem cliente").toBeDisabled();
    await checkout.getByRole("spinbutton").fill("1");
    await expect(concluir, "troca 1 por 1 não precisa de cliente").toBeEnabled();
    await concluir.click();
    await expect(page.getByText("Venda concluída")).toBeVisible();
    await page.getByRole("button", { name: "Nova venda" }).click();

    // ---- venda no fiado com cliente cadastrado na hora
    const nome = `Cliente E2E ${Date.now() % 100000}`;
    // o clique mantém o filtro da busca (aqui ainda era "Litr"): busca a Água
    await page.getByPlaceholder(/Passe o leitor/).fill("Água");
    await page.locator("ul button", { hasText: "Água Mineral" }).first().click();
    await page.getByRole("button", { name: /Finalizar venda/ }).click();
    const fiado = page.getByRole("dialog");
    await fiado.getByRole("button", { name: "Fiado", exact: true }).click();
    const concluirFiado = fiado.getByRole("button", { name: "Concluir", exact: true });
    await expect(concluirFiado, "fiado exige cliente").toBeDisabled();
    await fiado.getByRole("button", { name: /Escolher cliente/ }).click();
    await page.getByRole("button", { name: "Cadastrar novo cliente" }).click();
    await page.getByLabel("Nome do cliente").fill(nome);
    await page.getByRole("button", { name: "Cadastrar e escolher" }).click();
    await expect(concluirFiado).toBeEnabled();
    // cliente novo não deve nada: a venda sai sem aviso
    await concluirFiado.click();
    await expect(page.getByText("Venda concluída")).toBeVisible();
    await page.getByRole("button", { name: "Nova venda" }).click();

    // ---- segundo fiado do mesmo cliente: avisa quanto ele já deve e pergunta antes de vender
    await page.locator("ul button", { hasText: "Água Mineral" }).first().click();
    await page.getByRole("button", { name: /Finalizar venda/ }).click();
    const fiado2 = page.getByRole("dialog");
    await fiado2.getByRole("button", { name: "Fiado", exact: true }).click();
    await fiado2.getByRole("button", { name: /Escolher cliente/ }).click();
    await page.getByLabel("Buscar cliente").fill(nome);
    await page
      .getByRole("button", { name: new RegExp(nome) })
      .first()
      .click();
    await fiado2.getByRole("button", { name: "Concluir", exact: true }).click();

    const aviso = page.getByRole("alertdialog");
    await expect(aviso.getByText("Cliente com fiado em aberto")).toBeVisible();
    await expect(aviso).toContainText("2,50");
    await expect(aviso).toContainText("divididos em 1 venda");
    await expect(aviso).toContainText(/passa para\s*R\$\s*5,00/);
    // "Não": volta para o pagamento sem vender
    await aviso.getByRole("button", { name: "Não, voltar" }).click();
    await expect(aviso).toBeHidden();
    await expect(page.getByText("Venda concluída")).toBeHidden();
    // "Sim": conclui a venda
    await fiado2.getByRole("button", { name: "Concluir", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Sim, vender no fiado" })
      .click();
    await expect(page.getByText("Venda concluída")).toBeVisible();
    await page.getByRole("button", { name: "Nova venda" }).click();

    // ---- dívida e recebimento
    await goToStore(page, storeId, "/clientes");
    await page.getByPlaceholder("Buscar por nome ou telefone").fill(nome);
    // a dívida já aparece na lista, sem abrir o cliente; o filtro "só quem deve" o mantém
    const linha = page.getByRole("row", { name: new RegExp(nome) });
    await expect(linha).toContainText("5,00");
    // o dono vê também a dívida total (todas as lojas): aqui só deve nesta, então são iguais
    await expect(page.getByRole("columnheader", { name: "Dívida total" })).toBeVisible();
    await expect(linha.getByRole("cell").nth(4)).toHaveText(/5,00/);
    await page.getByRole("checkbox", { name: "Só quem deve no fiado" }).check();
    await expect(linha).toContainText("5,00");
    await page.getByRole("checkbox", { name: "Só quem deve no fiado" }).uncheck();
    await linha.getByRole("link", { name: "Abrir" }).click();
    await page.waitForURL(/\/clientes\//);
    const debtCard = page.getByText("Dívida nesta loja").locator("xpath=..");
    await expect(debtCard).toContainText("5,00");

    await page.getByRole("button", { name: "Receber pagamento" }).click();
    const pay = page.getByRole("dialog");
    await pay.getByLabel("Valor recebido").fill("10");
    await expect(
      pay.getByRole("button", { name: "Receber pagamento" }),
      "valor maior que a dívida é recusado",
    ).toBeDisabled();
    await pay.getByLabel("Valor recebido").fill("5,00");
    await pay.getByRole("button", { name: "Receber pagamento" }).click();
    await expect(page.getByText(/Pagamento de .* recebido/)).toBeVisible();
    await expect(debtCard).toContainText("0,00");

    // quitou: sai do filtro "só quem deve"
    await goToStore(page, storeId, "/clientes");
    await page.getByPlaceholder("Buscar por nome ou telefone").fill(nome);
    await expect(page.getByRole("row", { name: new RegExp(nome) })).not.toContainText("5,00");
    await page.getByRole("checkbox", { name: "Só quem deve no fiado" }).check();
    await expect(page.getByText("Nenhum cliente devendo no fiado")).toBeVisible();

    // ---- comanda: lançar, fechar com PIX
    await goToStore(page, storeId, "/comandas");
    await page.getByRole("button", { name: "Nova comanda" }).click();
    await page.getByLabel("Nome da comanda").fill("Mesa E2E");
    await page.getByRole("button", { name: "Abrir comanda" }).click();
    await page.waitForURL(/\/comandas\//);
    await page.getByPlaceholder(/Passe o leitor/).fill("Refri");
    await page.locator("ul button", { hasText: "Refrigerante" }).first().click();
    await expect(page.getByText("Refrigerante 2L").nth(1)).toBeVisible();
    await page.getByRole("button", { name: "Fechar comanda" }).click();
    const close = page.getByRole("dialog");
    await close.getByRole("button", { name: "PIX", exact: true }).click();
    await close.getByRole("button", { name: "Concluir", exact: true }).click();
    await page.waitForURL(/\/vendas\//);

    // ---- cancelar a venda e ver o histórico
    await page.getByRole("button", { name: "Cancelar venda" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar venda" }).click();
    await expect(page.getByText("Venda cancelada.")).toBeVisible();
    await page.getByRole("button", { name: "Histórico" }).click();
    const history = page.getByRole("dialog");
    await expect(history.getByText("Criado")).toBeVisible();
    await expect(history.getByText("Alterado")).toBeVisible();
    await expect(history.getByText("Cancelada")).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("comanda cancelada devolve o estoque", async ({ page }) => {
    const storeId = await openStore(page, "Loja Centro");
    await ensureCashOpen(page, storeId);

    const stockOf = async () => {
      await goToStore(page, storeId, "/estoque");
      const row = page.getByRole("row", { name: /Refrigerante 2L/ });
      return Number((await row.getByRole("cell").nth(3).innerText()).replace(/\D/g, ""));
    };
    const before = await stockOf();

    await goToStore(page, storeId, "/comandas");
    await page.getByRole("button", { name: "Nova comanda" }).click();
    await page.getByLabel("Nome da comanda").fill("Mesa cancelada");
    await page.getByRole("button", { name: "Abrir comanda" }).click();
    await page.waitForURL(/\/comandas\//);
    await page.getByPlaceholder(/Passe o leitor/).fill("Refri");
    await page.locator("ul button", { hasText: "Refrigerante" }).first().click();
    await expect(page.getByText("Refrigerante 2L").nth(1)).toBeVisible();
    expect(await stockOf()).toBe(before - 1);

    await page.goBack();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Cancelar comanda" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar comanda" }).click();
    // ao cancelar, a tela volta para a lista de comandas
    await page.waitForURL(/\/comandas$/);
    expect(await stockOf()).toBe(before);
  });

  test("caixa: entrada, sangria e resumo por forma de pagamento", async ({ page }) => {
    const storeId = await openStore(page, "Loja Centro");
    await ensureCashOpen(page, storeId);

    await page.getByRole("button", { name: "Entrada de dinheiro" }).click();
    await page.getByRole("dialog").getByLabel("Valor").fill("10");
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByText("Entrada registrada.")).toBeVisible();

    await page.getByRole("button", { name: /Saída \(sangria\)/ }).click();
    await page.getByRole("dialog").getByLabel("Valor").fill("5");
    await page.getByRole("button", { name: "Registrar saída" }).click();
    await expect(page.getByText("Saída registrada.")).toBeVisible();

    await page.getByRole("tab", { name: "Caixas anteriores" }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
  });

  test("venda em lote: fardo + unidade no PDV e fardo na comanda", async ({ page }) => {
    const errors = trackPageErrors(page);
    const storeId = await openStore(page, "Loja Centro");
    await ensureCashOpen(page, storeId);

    // Água Mineral: R$ 2,50 a unidade, fardo de 12
    await goToStore(page, storeId, "/pdv");
    await page.getByPlaceholder(/Passe o leitor/).fill("Água");
    await page.getByRole("button", { name: /Adicionar 1 fardo de 12 de Água Mineral/ }).click();
    const carrinho = page.getByRole("complementary", { name: "Carrinho" });
    await expect(carrinho.getByLabel("Fardos de Água Mineral 500ml", { exact: true })).toHaveValue(
      "1",
    );
    await expect(
      carrinho.getByLabel("Quantidade de Água Mineral 500ml", { exact: true }),
    ).toHaveValue("0");
    await carrinho
      .getByRole("button", { name: "Aumentar Quantidade de Água Mineral 500ml" })
      .click();
    await expect(carrinho).toContainText("13 un.");
    await expect(carrinho).toContainText(/32,50/); // 13 × R$ 2,50

    await page.getByRole("button", { name: /Finalizar venda/ }).click();
    const checkout = page.getByRole("dialog");
    await checkout.getByRole("button", { name: "PIX", exact: true }).click();
    await checkout.getByRole("button", { name: "Concluir", exact: true }).click();
    await expect(page.getByText("Venda concluída")).toBeVisible();
    await page.getByRole("link", { name: "Ver venda" }).click();
    await page.waitForURL(/\/vendas\/[0-9a-f-]{36}$/);
    await expect(page.getByText("1 fardo de 12 + 1 un.")).toBeVisible();

    // comanda: "+ fardo" lança 12 unidades de uma vez
    await goToStore(page, storeId, "/comandas");
    await page.getByRole("button", { name: "Nova comanda" }).click();
    await page.getByLabel("Nome da comanda").fill("Mesa fardo");
    await page.getByRole("button", { name: "Abrir comanda" }).click();
    await page.waitForURL(/\/comandas\//);
    await page.getByPlaceholder(/Passe o leitor/).fill("Água");
    await page.getByRole("button", { name: /Adicionar 1 fardo de 12 de Água Mineral/ }).click();
    await expect(page.getByText(/1 fardo de 12 · 12 ×/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar comanda" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar comanda" }).click();
    await page.waitForURL(/\/comandas$/);

    expect(errors).toEqual([]);
  });

  test("venda antiga: lançada com a data em que aconteceu e marcada como lançada depois", async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    const storeId = await openStore(page, "Loja Centro");
    await ensureCashOpen(page, storeId);

    // ontem às 10:00 (hora local, como o campo datetime-local)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const day = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

    // fica no menu, logo abaixo de Histórico de vendas
    await goToStore(page, storeId, "/vendas");
    const menu = await page.locator("aside").innerText();
    expect(menu).toMatch(/Histórico de vendas\s+Lançar venda antiga/);
    await page.locator("aside").getByRole("link", { name: "Lançar venda antiga" }).click();
    await page.waitForURL(/\/lancar-venda-antiga$/);
    await expect(page.getByRole("heading", { name: "Lançar venda antiga" })).toBeVisible();

    await page.getByPlaceholder(/Passe o leitor/).fill("Água");
    await page.locator("ul button", { hasText: "Água Mineral" }).first().click();
    const lancar = page.getByRole("button", { name: /Lançar venda/ });
    await expect(lancar, "sem a data não lança").toBeDisabled();

    // data no futuro é recusada na tela
    const tomorrow = new Date(Date.now() + 2 * 86_400_000);
    await page
      .getByLabel("Data e hora em que a venda aconteceu")
      .fill(
        `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T10:00`,
      );
    await expect(page.getByText("A data da venda não pode ser no futuro.").first()).toBeVisible();
    await expect(lancar).toBeDisabled();

    await page.getByLabel("Data e hora em que a venda aconteceu").fill(`${day}T10:00`);
    await lancar.click();
    const checkout = page.getByRole("dialog");
    await checkout.getByRole("button", { name: "PIX", exact: true }).click();
    await checkout.getByRole("button", { name: "Concluir", exact: true }).click();
    await expect(page.getByText("Venda antiga lançada")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(`${pad(yesterday.getDate())}/`);

    // aparece no dia em que aconteceu, com a marca
    await page.getByRole("link", { name: "Ver venda" }).click();
    await page.waitForURL(/\/vendas\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/Venda antiga, lançada depois em/)).toBeVisible();

    await goToStore(page, storeId, "/vendas");
    const filtros = page.locator("label", { hasText: "De" }).locator("input");
    await filtros.fill(day);
    await page.locator("label", { hasText: "até" }).locator("input").fill(day);
    await expect(page.getByText("lançada depois").first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
