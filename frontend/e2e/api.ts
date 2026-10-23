import { accessTokenOf } from "./session";

/**
 * Acesso direto ao backend (porta 3001), só para preparar e desfazer dados nos testes. As telas
 * continuam sendo testadas pelo navegador, passando pelo BFF do Next. Usa os access tokens das
 * sessões salvas, sem fazer login de novo (o login tem limite de tentativas).
 */
const API = process.env.E2E_API_URL ?? "http://localhost:3001/api";

export const PASSWORD = "123456";

export async function backend<T>(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

interface Membership {
  companyId: string;
  companyName: string;
  organizationId: string;
  stores: { storeId: string; storeName: string }[];
}

/** Empresa e lojas do dono do seed. */
export async function seedCompany() {
  const token = accessTokenOf("dono");
  const memberships = await backend<Membership[]>("GET", "/me/memberships", { token });
  return { token, ...memberships[0] };
}

/** Garante estoque nos produtos de uma loja, para os testes poderem rodar várias vezes. */
export async function refillStock(token: string, storeId: string, minimum = 60) {
  const page = await backend<{ data: { id: string; stock: number }[] }>(
    "GET",
    `/stores/${storeId}/store-products?limit=100`,
    { token },
  );
  for (const item of page.data) {
    if (item.stock < minimum) {
      await backend("POST", `/stores/${storeId}/store-products/${item.id}/stock-entries`, {
        token,
        body: { quantity: minimum - item.stock + 20 },
      });
    }
  }
}

/** Ajuste manual da assinatura pela plataforma (é como se simula atraso e somente leitura). */
export async function setSubscription(
  organizationId: string,
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED",
) {
  await backend("PATCH", `/platform/organizations/${organizationId}`, {
    token: accessTokenOf("admin"),
    body: { subscriptionStatus: status },
  });
}
