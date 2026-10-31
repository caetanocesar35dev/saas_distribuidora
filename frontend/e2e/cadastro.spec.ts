import { expect, test } from "@playwright/test";
import { randomCnpj as cnpj } from "./api";
import { trackPageErrors } from "./helpers";

test("cadastro de conta nova, administração da empresa e conta pessoal", async ({ page }) => {
  const errors = trackPageErrors(page);
  const stamp = Date.now() % 1_000_000;
  const email = `novo${stamp}@exemplo-teste.com`;
  const document = cnpj();
  const branchDocument = cnpj();

  // A consulta pública de CNPJ é simulada: o teste não depende da internet nem do limite dela.
  const lookups: string[] = [];
  await page.route("https://publica.cnpj.ws/cnpj/*", (route) => {
    const asked = route.request().url().split("/").pop() ?? "";
    lookups.push(asked);
    if (asked === document) {
      return route.fulfill({
        json: {
          razao_social: `Distribuidora Nova ${stamp} LTDA`,
          estabelecimento: { nome_fantasia: "Bebidas Nova" },
        },
      });
    }
    if (asked === branchDocument) {
      return route.fulfill({
        json: {
          razao_social: `Distribuidora Nova ${stamp} LTDA`,
          estabelecimento: {
            nome_fantasia: "Bebidas Nova Filial",
            tipo_logradouro: "RUA",
            logradouro: "DAS FLORES",
            numero: "120",
            bairro: "CENTRO",
            cep: "01001000",
            ddd1: "11",
            telefone1: "33334444",
            cidade: { nome: "São Paulo" },
            estado: { sigla: "SP" },
          },
        },
      });
    }
    return route.fulfill({ status: 404, json: { status: 404 } });
  });

  // ---- cadastro (CNPJ inválido é barrado na tela e nem é consultado)
  await page.goto("/cadastro");
  // o campo de nome não aceita números nem símbolos (digitados ou colados): só as letras ficam
  await page.getByLabel("Seu nome").fill("Dono 123 Novo@#");
  await expect(page.getByLabel("Seu nome")).toHaveValue("Dono  Novo");
  await page.getByLabel("Seu nome").fill("Dono Novo");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Celular (WhatsApp)").fill("81999990000");
  await expect(page.getByLabel("Celular (WhatsApp)")).toHaveValue("(81) 99999-0000");
  await page.getByLabel("Senha", { exact: true }).fill("senha1234");
  await page.getByLabel("Repita a senha").fill("senha1234");
  await page.getByLabel("CNPJ").fill("11.111.111/1111-11");
  await page.getByLabel("Nome da primeira loja").fill("Loja Matriz");
  await page.getByRole("button", { name: "Criar conta e começar" }).click();
  await expect(page.getByText("CNPJ inválido.")).toBeVisible();
  // sem aceitar os termos (LGPD) a conta não é criada
  await expect(
    page.getByText("Para criar a conta, aceite os termos de uso e a política de privacidade."),
  ).toBeVisible();
  expect(lookups).toEqual([]);

  // ---- CNPJ alfanumérico, digitado em minúsculas: a máscara corrige e a consulta preenche
  await page.getByLabel("CNPJ").fill(document.toLowerCase());
  await expect(page.getByLabel("CNPJ")).toHaveValue(
    `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8, 12)}-${document.slice(12)}`,
  );
  await expect(page.getByLabel("Razão social")).toHaveValue(`Distribuidora Nova ${stamp} LTDA`);
  await expect(page.getByLabel("Nome fantasia (opcional)")).toHaveValue("Bebidas Nova");
  await expect(page.getByText(/preenchidos com a consulta pública do CNPJ/)).toBeVisible();
  expect(lookups).toEqual([document]);
  await page.getByRole("checkbox", { name: /Li e aceito os Termos de uso/ }).check();
  await page.getByRole("button", { name: "Criar conta e começar" }).click();
  await page.waitForURL(/\/loja\//, { timeout: 20_000 });
  await expect(page.getByText(/Seu período de teste termina em/).first()).toBeVisible();

  // ---- empresa: equipe, nova loja, assinatura
  await page.getByRole("link", { name: "Painel da empresa" }).first().click();
  await page.waitForURL(/\/empresa\//);
  await page.getByRole("link", { name: "Equipe" }).first().click();
  await expect(page.getByText("Dono Novo").first()).toBeVisible();

  await page.getByRole("link", { name: "Lojas" }).first().click();
  await page.getByRole("button", { name: "Nova loja" }).click();
  // O CNPJ da loja preenche endereço e telefone; o nome já digitado não é trocado.
  await page.getByLabel("Nome da loja").fill("Loja Filial");
  await page.getByLabel("CNPJ da loja (opcional)").fill("12.345");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("CNPJ inválido.")).toBeVisible();
  await page.getByLabel("CNPJ da loja (opcional)").fill(branchDocument);
  await expect(page.getByLabel("Rua")).toHaveValue("RUA DAS FLORES");
  await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
  await expect(page.getByLabel("UF")).toHaveValue("SP");
  await expect(page.getByLabel("CEP")).toHaveValue("01001-000");
  await expect(page.getByLabel("Telefone")).toHaveValue("(11) 3333-4444");
  await expect(page.getByLabel("Nome da loja")).toHaveValue("Loja Filial");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Loja criada.")).toBeVisible();
  await expect(page.getByText("Loja Filial").first()).toBeVisible();
  await expect(page.getByText(/RUA DAS FLORES, 120/)).toBeVisible();

  await page.getByRole("link", { name: "Assinatura" }).first().click();
  await expect(page.getByText("Como regularizar").first()).toBeVisible();

  // ---- conta pessoal
  await page.goto("/conta");
  await page.getByLabel("Nome", { exact: true }).fill("Dono Novo Editado");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.getByText("Dados atualizados.")).toBeVisible();

  await page.getByLabel("Senha atual").fill("senha1234");
  await page.getByLabel("Nova senha", { exact: true }).fill("outrasenha99");
  await page.getByLabel("Repita a nova senha").fill("outrasenha99");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText(/Senha alterada/)).toBeVisible();

  // continua logado neste aparelho depois de trocar a senha
  await page.goto("/selecionar?trocar=1");
  await expect(page).toHaveURL(/\/selecionar/);

  // e a senha nova funciona num login novo
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await page.waitForURL(/\/login/);
  await page.fill("#email", email);
  await page.fill("#password", "outrasenha99");
  await page.click("button[type=submit]");
  // agora são duas lojas: a seleção de loja aparece
  await page.waitForURL(/\/(loja|selecionar)/, { timeout: 20_000 });

  expect(errors).toEqual([]);
});
