import { formatPhone, isValidCnpj, normalizeCnpj, onlyDigits } from "@/lib/format";

/**
 * Consulta pública de CNPJ (CNPJ.ws, gratuita, sem chave). É chamada direto do navegador (a API
 * libera CORS): o limite dela é de 3 consultas por minuto **por IP**, e passando pelo servidor do
 * Next todos os clientes dividiriam o mesmo limite. Só serve para sugerir razão social e nome
 * fantasia; o cadastro nunca depende dela.
 */
export const CNPJ_LOOKUP_URL = "https://publica.cnpj.ws/cnpj/";

/** Dados públicos do estabelecimento; endereço e telefone servem para a tela de lojas. */
export type CnpjData = {
  razaoSocial: string;
  nomeFantasia: string | null;
  phone: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

export type CnpjLookupResult =
  { status: "found"; data: CnpjData } | { status: "not-found" } | { status: "unavailable" };

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

type Establishment = {
  nome_fantasia?: unknown;
  tipo_logradouro?: unknown;
  logradouro?: unknown;
  numero?: unknown;
  complemento?: unknown;
  bairro?: unknown;
  cep?: unknown;
  ddd1?: unknown;
  telefone1?: unknown;
  cidade?: { nome?: unknown } | null;
  estado?: { sigla?: unknown } | null;
};

/** Corta no tamanho que o formulário aceita (evita erro de validação com dado longo). */
const fit = (value: string | null, max: number) => (value ? value.slice(0, max).trim() : null);

/** Extrai os dados da resposta (null se não vier razão social). */
export function parseCnpjResponse(body: unknown): CnpjData | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { razao_social?: unknown; estabelecimento?: Establishment | null };
  const razaoSocial = text(record.razao_social);
  if (!razaoSocial) return null;
  const e = record.estabelecimento ?? {};

  const cep = onlyDigits(text(e.cep) ?? "");
  const phone = onlyDigits(`${text(e.ddd1) ?? ""}${text(e.telefone1) ?? ""}`);
  const street = [text(e.tipo_logradouro), text(e.logradouro)].filter(Boolean).join(" ");
  const state = text(e.estado?.sigla);

  return {
    razaoSocial,
    nomeFantasia: text(e.nome_fantasia),
    phone: phone.length === 10 || phone.length === 11 ? formatPhone(phone) : null,
    zipCode: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : null,
    street: fit(street || null, 200),
    number: fit(text(e.numero), 20),
    complement: fit(text(e.complemento), 100),
    neighborhood: fit(text(e.bairro), 100),
    city: fit(text(e.cidade?.nome), 100),
    state: state && /^[A-Za-z]{2}$/.test(state) ? state.toUpperCase() : null,
  };
}

// Resultados já obtidos nesta aba: digitar o mesmo CNPJ de novo não gasta consulta.
const cache = new Map<string, CnpjLookupResult>();

export async function lookupCnpj(value: string, signal?: AbortSignal): Promise<CnpjLookupResult> {
  const cnpj = normalizeCnpj(value);
  if (!isValidCnpj(cnpj)) return { status: "not-found" };
  const cached = cache.get(cnpj);
  if (cached) return cached;

  let result: CnpjLookupResult;
  try {
    const response = await fetch(CNPJ_LOOKUP_URL + cnpj, {
      signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404 || response.status === 400) {
      result = { status: "not-found" };
    } else if (!response.ok) {
      return { status: "unavailable" }; // 429 ou erro do serviço: não guarda, pode tentar depois
    } else {
      const data = parseCnpjResponse(await response.json());
      result = data ? { status: "found", data } : { status: "not-found" };
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unavailable" };
  }
  cache.set(cnpj, result);
  return result;
}

/** Só para testes. */
export function clearCnpjLookupCache() {
  cache.clear();
}
