import { expect, test } from "@playwright/test";
import { goToStore, openStore, trackPageErrors } from "./helpers";
import { STATE } from "./session";

test.describe("estoque, produtos, vasilhames e clientes", () => {
  test.use({ storageState: STATE.dono });

  test("entrada, ajuste e preço do estoque", async ({ page }) => {
    const errors = trackPageErrors(page);
    const storeId = await openStore(page, "Loja Centro");
    await goToStore(page, storeId, "/estoque");

    await page.getByRole("button", { name: "Entrada" }).first().click();
    await page.getByRole("dialog").getByRole("spinbutton").fill("5");
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByText(/Entrada registrada/)).toBeVisible();

    await page.getByRole("button", { name: "Mais ações" }).first().click();
    await page.getByRole("menuitem", { name: /Ajuste de inventário/ }).click();
    const adjust = page.getByRole("dialog");
    await adjust.getByLabel("Quantidade contada").fill("200");
    await adjust.getByLabel("Motivo do ajuste").fill("contagem do teste");
    await adjust.getByRole("button", { name: "Ajustar estoque" }).click();
    await expect(page.getByText(/Estoque ajustado para 200/)).toBeVisible();

    await page.getByRole("button", { name: "Mais ações" }).first().click();
    await page.getByRole("menuitem", { name: /Preço e custo/ }).click();
    await expect(page.getByRole("dialog").getByText(/mudam só nesta loja/)).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

    await page.getByRole("tab", { name: "Estoque baixo" }).click();
    await page.getByRole("button", { name: "Colocar produto na loja" }).click();
    await expect(page.getByRole("dialog").getByPlaceholder(/Buscar por nome/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("produto novo em uma loja, código repetido mostra o erro e a edição abre", async ({
    page,
  }) => {
    const storeId = await openStore(page, "Loja Centro");
    const nome = `Produto E2E ${Date.now() % 100000}`;

    await goToStore(page, storeId, "/produtos/novo");
    await page.getByLabel("Nome do produto").fill(nome);
    await page.getByLabel("Preço de venda nesta loja").first().fill("7,5");
    await page.getByRole("button", { name: "Cadastrar produto" }).click();
    await page.waitForURL(/\/estoque/);
    await expect(page.getByText(nome)).toBeVisible();

    await goToStore(page, storeId, "/produtos/novo");
    await page.getByLabel("Nome do produto").fill("Duplicado");
    await page.getByLabel(/Código de barras/).fill("7891000100103");
    await page.getByLabel("Preço de venda nesta loja").first().fill("1");
    await page.getByRole("button", { name: "Cadastrar produto" }).click();
    await expect(page.getByText(/Já existe um produto com o código/)).toBeVisible();

    await goToStore(page, storeId, "/produtos");
    await page.getByRole("button", { name: "Editar" }).first().click();
    await expect(page.getByRole("dialog").getByLabel("Nome do produto")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

    await page.getByRole("button", { name: "Histórico de alterações" }).first().click();
    await expect(page.getByRole("dialog").getByText(/Histórico de/)).toBeVisible();
  });

  test("vasilhames: recebimento do fornecedor, tipo repetido, empréstimo e devolução do cliente", async ({
    page,
  }) => {
    const storeId = await openStore(page, "Loja Centro");
    await goToStore(page, storeId, "/vasilhames");

    await page.getByRole("button", { name: "Receber do fornecedor" }).click();
    const receive = page.getByRole("dialog");
    await receive.getByLabel("Tipo de vasilhame").click();
    await page.getByRole("option").first().click();
    await receive.getByLabel("Quantidade").fill("3");
    await receive.getByRole("button", { name: "Registrar recebimento" }).click();
    await expect(page.getByText("Movimentação registrada.")).toBeVisible();

    await page.getByRole("tab", { name: "Tipos de vasilhame" }).click();
    await page.getByRole("button", { name: "Novo tipo" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Litrão");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(/Já existe um tipo de vasilhame/)).toBeVisible();
    await page.keyboard.press("Escape");

    // ---- cliente novo: empréstimo e devolução (só até o que deve)
    await goToStore(page, storeId, "/clientes");
    const nome = `Maria E2E ${Date.now() % 100000}`;
    await page.getByRole("button", { name: "Novo cliente" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(nome);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Cliente cadastrado.")).toBeVisible();

    await page.getByPlaceholder("Buscar por nome ou telefone").fill(nome);
    await page
      .getByRole("row", { name: new RegExp(nome) })
      .getByRole("link", { name: "Abrir" })
      .click();
    await page.waitForURL(/\/clientes\//);

    await page.getByRole("button", { name: "Emprestar vasilhame" }).click();
    const loan = page.getByRole("dialog");
    await loan.getByLabel("Vasilhame").click();
    await page.getByRole("option").first().click();
    await loan.getByLabel("Quantidade").fill("2");
    await loan.getByRole("button", { name: "Registrar empréstimo" }).click();
    await expect(page.getByText("Empréstimo registrado.")).toBeVisible();

    await page.getByRole("button", { name: "Devolução de vasilhame" }).click();
    const giveBack = page.getByRole("dialog");
    await giveBack.getByLabel("Quantidade devolvida").fill("5");
    await expect(giveBack.getByText(/deve só/)).toBeVisible();
    await giveBack.getByLabel("Quantidade devolvida").fill("2");
    await giveBack.getByRole("button", { name: "Registrar devolução" }).click();
    await expect(page.getByText("Devolução registrada.")).toBeVisible();
  });

  test("cliente com endereço opcional: o CEP preenche e a edição pode apagar", async ({ page }) => {
    const errors = trackPageErrors(page);
    // A ViaCEP é simulada: o teste não depende da internet.
    const asked: string[] = [];
    await page.route("https://viacep.com.br/ws/**", (route) => {
      asked.push(route.request().url());
      return route.fulfill({
        json: {
          logradouro: "Rua da Aurora",
          bairro: "Boa Vista",
          localidade: "Recife",
          uf: "PE",
        },
      });
    });
    const storeId = await openStore(page, "Loja Centro");
    const nome = `Cliente Endereço ${Date.now() % 100000}`;
    await goToStore(page, storeId, "/clientes");

    // sem endereço: continua funcionando (é opcional)
    await page.getByRole("button", { name: "Novo cliente" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(`Sem ${nome}`);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Cliente cadastrado.")).toBeVisible();

    // com endereço: o CEP completo traz rua, bairro, cidade e UF; número e complemento são digitados
    await page.getByRole("button", { name: "Novo cliente" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(nome);
    await page.getByLabel("Rua").fill("Rua que a pessoa já digitou");
    await page.getByLabel("CEP").fill("50030230");
    await expect(page.getByLabel("CEP")).toHaveValue("50030-230");
    await expect(page.getByLabel("Cidade")).toHaveValue("Recife");
    await expect(page.getByLabel("UF")).toHaveValue("PE");
    await expect(page.getByLabel("Bairro")).toHaveValue("Boa Vista");
    // o que a pessoa digitou antes não é trocado
    await expect(page.getByLabel("Rua")).toHaveValue("Rua que a pessoa já digitou");
    expect(asked).toEqual(["https://viacep.com.br/ws/50030230/json/"]);
    await page.getByLabel("Número").fill("100");
    await page.getByLabel("Complemento").fill("Sala 3");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Cliente cadastrado.")).toBeVisible();

    // o detalhe mostra o endereço
    await page.getByPlaceholder("Buscar por nome ou telefone").fill(nome);
    await page
      .getByRole("row", { name: new RegExp(`^${nome}`) })
      .getByRole("link", { name: "Abrir" })
      .click();
    await page.waitForURL(/\/clientes\//);
    await expect(
      page.getByText(
        "Rua que a pessoa já digitou, 100 - Sala 3 · Boa Vista · Recife/PE · CEP 50030-230",
      ),
    ).toBeVisible();

    // editar: texto vazio apaga o complemento e o endereço some do cabeçalho quando tudo é apagado
    await page.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByLabel("Complemento")).toHaveValue("Sala 3");
    for (const label of ["CEP", "Rua", "Número", "Complemento", "Bairro", "Cidade", "UF"]) {
      await page.getByLabel(label, { exact: true }).fill("");
    }
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Cliente atualizado.")).toBeVisible();
    await expect(page.getByText(/CEP 50030-230/)).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("excluir um cliente sem dívida volta para a lista e ele some", async ({ page }) => {
    const storeId = await openStore(page, "Loja Centro");
    const nome = `Cliente Excluir ${Date.now() % 100000}`;
    await goToStore(page, storeId, "/clientes");
    await page.getByRole("button", { name: "Novo cliente" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(nome);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Cliente cadastrado.")).toBeVisible();

    await page.getByPlaceholder("Buscar por nome ou telefone").fill(nome);
    await page
      .getByRole("row", { name: new RegExp(nome) })
      .getByRole("link", { name: "Abrir" })
      .click();
    await page.waitForURL(/\/clientes\//);

    await page.getByRole("button", { name: "Excluir" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir cliente" }).click();
    // sai da página do cliente excluído (nada de "cliente não encontrado")
    await page.waitForURL(/\/clientes$/);

    await page.getByPlaceholder("Buscar por nome ou telefone").fill(nome);
    await expect(page.getByText("Nenhum cliente encontrado")).toBeVisible();
  });

  test("devolução só vale na loja da dívida: na outra loja o sistema avisa", async ({ page }) => {
    const storeId = await openStore(page, "Loja Centro");
    await goToStore(page, storeId, "/clientes");
    const nome = `Cliente Cruzado ${Date.now() % 100000}`;
    await page.getByRole("button", { name: "Novo cliente" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(nome);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Cliente cadastrado.")).toBeVisible();
    await page.getByPlaceholder("Buscar por nome ou telefone").fill(nome);
    await page
      .getByRole("row", { name: new RegExp(nome) })
      .getByRole("link", { name: "Abrir" })
      .click();
    await page.waitForURL(/\/clientes\/([0-9a-f-]+)/);
    const customerUrl = new URL(page.url());
    const customerId = customerUrl.pathname.split("/").pop();

    await page.getByRole("button", { name: "Emprestar vasilhame" }).click();
    const loan = page.getByRole("dialog");
    await loan.getByLabel("Vasilhame").click();
    await page.getByRole("option").first().click();
    await loan.getByLabel("Quantidade").fill("1");
    await loan.getByRole("button", { name: "Registrar empréstimo" }).click();
    await expect(page.getByText("Empréstimo registrado.")).toBeVisible();

    // na outra loja a dívida aparece como "em outra loja" e a devolução não é oferecida
    await page
      .getByRole("button", { name: /Loja Centro/ })
      .first()
      .click();
    await page.getByRole("menuitem", { name: /Loja Norte/ }).click();
    await page.waitForURL(/\/loja\/[0-9a-f-]+$/); // a página inicial da outra loja
    const norteId = page.url().match(/\/loja\/([0-9a-f-]+)/)?.[1];
    await page.goto(`/loja/${norteId}/clientes/${customerId}`);
    await page.getByRole("button", { name: "Devolução de vasilhame" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/também deve vasilhames em outra loja/)).toBeVisible();
    await expect(dialog.getByText(/não deve vasilhames nesta loja/)).toBeVisible();
  });
});
