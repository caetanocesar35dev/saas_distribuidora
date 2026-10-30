import { expect, test } from "@playwright/test";
import { backend, seedCompany } from "./api";
import { trackPageErrors } from "./helpers";
import { EMAIL, STATE } from "./session";

interface Member {
  membershipId: string;
  isGeneralManager: boolean;
  user: { email: string };
  stores: { storeId: string; storeName: string; role: string }[];
}

test("gerente geral: o dono marca, e o gerente passa a ver o painel e a equipe da empresa", async ({
  browser,
}) => {
  const company = await seedCompany();
  const members = await backend<Member[]>("GET", `/companies/${company.companyId}/members`, {
    token: company.token,
  });
  const manager = members.find((m) => m.user.email === EMAIL.gerente)!;
  // Lojas em que o gerente do seed NÃO estava: no fim, ele sai delas de novo.
  const extraStores = company.stores.filter(
    (s) => !manager.stores.some((ms) => ms.storeId === s.storeId),
  );

  const ownerContext = await browser.newContext({ storageState: STATE.dono });
  const managerContext = await browser.newContext({ storageState: STATE.gerente });
  try {
    // ---- o dono torna o gerente gerente geral
    const owner = await ownerContext.newPage();
    const ownerErrors = trackPageErrors(owner);
    await owner.goto(`/empresa/${company.companyId}/equipe`);
    const card = owner.getByRole("article").filter({ hasText: EMAIL.gerente });
    await card.getByRole("button", { name: "Tornar gerente geral" }).click();
    await owner.getByRole("alertdialog").getByRole("button", { name: "Tornar gerente geral" }).click();
    await expect(owner.getByText(/Agora é gerente geral/)).toBeVisible();
    await expect(card.getByText("Gerente geral", { exact: true })).toBeVisible();
    // gerente em todas as lojas
    for (const store of company.stores) {
      await expect(card.getByText(store.storeName, { exact: true })).toBeVisible();
    }
    expect(ownerErrors).toEqual([]);

    // ---- o gerente geral vê o painel da empresa e a equipe, mas não mexe no dono
    const page = await managerContext.newPage();
    const errors = trackPageErrors(page);
    await page.goto(`/empresa/${company.companyId}`);
    await expect(page.getByRole("heading", { name: "Painel da empresa" })).toBeVisible();
    await expect(page.getByText("Você não tem permissão")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Dados da empresa" })).toHaveCount(0);

    await page.goto(`/empresa/${company.companyId}/equipe`);
    const ownerCard = page.getByRole("article").filter({ hasText: EMAIL.dono });
    await expect(ownerCard).toBeVisible();
    await expect(ownerCard.getByRole("button", { name: "Remover da empresa" })).toHaveCount(0);
    await expect(page.getByText("Mostrar quem foi removido")).toHaveCount(0);

    await page.goto(`/empresa/${company.companyId}/lojas`);
    await expect(page.getByRole("button", { name: "Editar" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Excluir" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nova loja" })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    // volta o gerente do seed ao que era (gerente comum, só nas lojas de antes)
    await backend(
      "PUT",
      `/companies/${company.companyId}/members/${manager.membershipId}/general-manager`,
      { token: company.token, body: { isGeneralManager: false } },
    );
    for (const store of extraStores) {
      await backend(
        "DELETE",
        `/companies/${company.companyId}/members/${manager.membershipId}/stores/${store.storeId}`,
        { token: company.token },
      );
    }
    await ownerContext.close();
    await managerContext.close();
  }
});
