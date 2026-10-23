import { mkdirSync } from "node:fs";
import { request, type FullConfig } from "@playwright/test";
import { PASSWORD, refillStock, seedCompany, setSubscription } from "./api";
import { AUTH_DIR, EMAIL, STATE, type Role } from "./session";

/** Entra uma vez por papel (pelo BFF do Next) e guarda a sessão para os testes reaproveitarem. */
async function saveSession(baseURL: string, role: Role) {
  const context = await request.newContext({ baseURL });
  const response = await context.post("/api/auth/login", {
    data: { email: EMAIL[role], password: PASSWORD },
  });
  if (!response.ok()) {
    throw new Error(
      `login de ${EMAIL[role]} falhou (${response.status()}): ${await response.text()}. ` +
        "O login tem limite de 5 por minuto e 20 por hora por e-mail: se acabou de rodar várias " +
        "vezes, espere um pouco.",
    );
  }
  await context.storageState({ path: STATE[role] });
  await context.dispose();
}

/** Confere que o backend está de pé com o seed e deixa o ambiente pronto para os testes. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  mkdirSync(AUTH_DIR, { recursive: true });
  try {
    for (const role of Object.keys(STATE) as Role[]) await saveSession(baseURL, role);
    const company = await seedCompany();
    // Uma execução interrompida no meio do teste de somente leitura não pode travar as seguintes.
    await setSubscription(company.organizationId, "TRIAL");
    for (const store of company.stores) await refillStock(company.token, store.storeId);
  } catch (error) {
    throw new Error(
      "Não foi possível preparar os testes de ponta a ponta. Confira se o banco e o backend " +
        "(porta 3001) estão de pé e se o seed foi rodado (`npm run db:seed` em backend/). " +
        `Detalhe: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
