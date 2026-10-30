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

/**
 * CNPJ **alfanumérico** válido (com os dígitos verificadores) gerado na hora, para o cadastro não
 * repetir. Cada caractere vale o código ASCII menos 48 (dígito = ele mesmo, A = 17).
 */
export function randomCnpj(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const base = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)])
    .concat(["A", "0", "0", "1"])
    .join("");
  const digit = (text: string) => {
    let factor = text.length - 7;
    let sum = 0;
    for (const ch of text) {
      sum += (ch.charCodeAt(0) - 48) * factor--;
      if (factor < 2) factor = 9;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = digit(base);
  return `${base}${d1}${digit(`${base}${d1}`)}`;
}

/**
 * Conta nova pelo cadastro público (sem passar pela tela), opcionalmente com código de indicação.
 * Devolve a organização criada.
 */
export async function signupByApi(name: string, referralCode?: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const auth = await backend<{ access_token: string }>("POST", "/auth/signup", {
    body: {
      name: "Pessoa Indicada",
      email: `indicado${stamp}@exemplo-teste.com`,
      password: "Senha@123",
      cnpj: randomCnpj(),
      razaoSocial: `${name} LTDA`,
      nomeFantasia: name,
      storeName: "Matriz",
      acceptTerms: true,
      phone: "81999990000",
      referralCode,
    },
  });
  const [org] = await backend<{ id: string; name: string }[]>("GET", "/organizations/mine", {
    token: auth.access_token,
  });
  return org;
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
