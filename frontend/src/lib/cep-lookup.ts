import { onlyDigits } from "@/lib/format";

/**
 * Consulta pública de CEP (ViaCEP, gratuita, sem chave). Chamada direto do navegador (a API libera
 * CORS), como a consulta de CNPJ. Só serve para sugerir rua, bairro, cidade e UF; o cadastro nunca
 * depende dela.
 */
export const CEP_LOOKUP_URL = "https://viacep.com.br/ws/";

export type CepData = {
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

export type CepLookupResult =
  { status: "found"; data: CepData } | { status: "not-found" } | { status: "unavailable" };

/** Máscara 00000-000 enquanto digita. */
export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Extrai o endereço da resposta da ViaCEP (null se o CEP não existe: `{ "erro": true }`). */
export function parseCepResponse(body: unknown): CepData | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.erro) return null;
  const state = text(record.uf);
  const data = {
    street: text(record.logradouro),
    neighborhood: text(record.bairro),
    city: text(record.localidade),
    state: state && /^[A-Za-z]{2}$/.test(state) ? state.toUpperCase() : null,
  };
  // CEP "geral" de cidade pequena não tem rua nem bairro, mas tem cidade e UF.
  return data.city || data.street ? data : null;
}

// Resultados já obtidos nesta aba: digitar o mesmo CEP de novo não gasta consulta.
const cache = new Map<string, CepLookupResult>();

export async function lookupCep(value: string, signal?: AbortSignal): Promise<CepLookupResult> {
  const cep = onlyDigits(value);
  if (cep.length !== 8) return { status: "not-found" };
  const cached = cache.get(cep);
  if (cached) return cached;

  let result: CepLookupResult;
  try {
    const response = await fetch(`${CEP_LOOKUP_URL}${cep}/json/`, {
      signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    });
    if (response.status === 400 || response.status === 404) {
      result = { status: "not-found" };
    } else if (!response.ok) {
      return { status: "unavailable" }; // não guarda: pode tentar de novo
    } else {
      const data = parseCepResponse(await response.json());
      result = data ? { status: "found", data } : { status: "not-found" };
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unavailable" };
  }
  cache.set(cep, result);
  return result;
}

/** Só para testes. */
export function clearCepLookupCache() {
  cache.clear();
}
