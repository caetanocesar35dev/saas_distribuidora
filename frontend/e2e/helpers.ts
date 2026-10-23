import { expect, type Page } from "@playwright/test";
import { PASSWORD } from "./api";

/** Entra pela tela de login (só para os testes do próprio login: o limite é de 5 por minuto). */
export async function loginPelaTela(page: Page, email: string, storeName = "Loja Centro") {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(loja|selecionar)/, { timeout: 20_000 });
  if (page.url().includes("/selecionar")) {
    await page.getByRole("link", { name: new RegExp(storeName) }).first().click();
    await page.waitForURL(/\/loja\//);
  }
  await page.waitForLoadState("networkidle");
}

/** Com a sessão já salva: escolhe a loja pela tela de seleção e devolve o id dela. */
export async function openStore(page: Page, storeName = "Loja Centro"): Promise<string> {
  await page.goto("/selecionar?trocar=1");
  await page.getByRole("link", { name: new RegExp(storeName) }).first().click();
  await page.waitForURL(/\/loja\//);
  await page.waitForLoadState("networkidle");
  const match = page.url().match(/\/loja\/([0-9a-f-]+)/);
  if (!match) throw new Error(`não entrou numa loja: ${page.url()}`);
  return match[1];
}

export async function goToStore(page: Page, storeId: string, path = "") {
  await page.goto(`/loja/${storeId}${path}`);
  await page.waitForLoadState("networkidle");
}

/** Abre o caixa da loja se ele estiver fechado. */
export async function ensureCashOpen(page: Page, storeId: string) {
  await goToStore(page, storeId, "/caixa");
  const open = page.getByRole("button", { name: "Abrir caixa" });
  if (await open.count()) await open.click();
  await expect(page.getByText("Saldo atual")).toBeVisible();
}

/** Registra erros de execução da página (JavaScript quebrado) para o teste falhar com eles. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
