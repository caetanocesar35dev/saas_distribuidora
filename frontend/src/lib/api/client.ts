/**
 * Cliente da API. Roda no navegador e fala só com o BFF do Next (`/api/...`, mesma origem): os
 * tokens ficam em cookies httpOnly e são colocados na chamada pelo servidor. As telas nunca montam
 * ids de empresa/loja nem cabeçalhos à mão: usam `companyApi(id)` e `storeApi(id)`.
 */

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

export class ApiError extends Error {
  readonly status: number;
  /** Mensagens do backend (em português). Erro de validação (400) traz várias. */
  readonly messages: string[];
  readonly code?: string;
  readonly reason?: string;

  constructor(
    status: number,
    messages: string[],
    extra: { code?: string; reason?: string } = {},
  ) {
    super(messages.join(" "));
    this.name = "ApiError";
    this.status = status;
    this.messages = messages;
    this.code = extra.code;
    this.reason = extra.reason;
  }

  get isReadOnly() {
    return this.status === 402 && this.code === "SUBSCRIPTION_READ_ONLY";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.messages.join(" ");
  if (error instanceof Error) return error.message;
  return "Algo deu errado. Tente novamente.";
}

// ---- Eventos globais (sessão expirada e modo somente leitura) --------------------------------

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
const readOnlyListeners = new Set<Listener>();

export const apiEvents = {
  onUnauthorized(listener: Listener) {
    unauthorizedListeners.add(listener);
    return () => unauthorizedListeners.delete(listener);
  },
  onReadOnly(listener: Listener) {
    readOnlyListeners.add(listener);
    return () => readOnlyListeners.delete(listener);
  },
};

// ---- Requisições -----------------------------------------------------------------------------

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /**
   * `false` em chamadas públicas (login, cadastro...): um 401 ali é "credenciais erradas" e não
   * "sessão expirada".
   */
  session?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ""}`;
}

function toMessages(body: unknown, status: number): string[] {
  // O limitador de requisições do backend responde em inglês.
  if (status === 429) {
    return ["Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo."];
  }
  if (typeof body === "object" && body !== null && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.map(String);
    if (typeof message === "string" && message) return [message];
  }
  if (status === 502 || status === 503) {
    return ["Não foi possível falar com o servidor. Tente novamente em instantes."];
  }
  return ["Algo deu errado. Tente novamente."];
}

export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const hasBody = options.body !== undefined;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, [
      "Sem conexão com o servidor. Verifique a internet e tente novamente.",
    ]);
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (res.ok) return body as T;

  const extra =
    typeof body === "object" && body !== null
      ? {
          code: (body as { code?: string }).code,
          reason: (body as { reason?: string }).reason,
        }
      : {};
  const error = new ApiError(res.status, toMessages(body, res.status), extra);

  if (res.status === 401 && options.session !== false) {
    unauthorizedListeners.forEach((l) => l());
  }
  if (error.isReadOnly) readOnlyListeners.forEach((l) => l());
  throw error;
}

export interface Scoped {
  get<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

function scoped(base: string, session = true): Scoped {
  return {
    get: (path, query, signal) =>
      request("GET", base + path, { query, signal, session }),
    post: (path, body) => request("POST", base + path, { body, session }),
    put: (path, body) => request("PUT", base + path, { body, session }),
    patch: (path, body) => request("PATCH", base + path, { body, session }),
    delete: (path) => request("DELETE", base + path, { session }),
  };
}

/** Rotas fora de empresa/loja (`/me`, `/auth`, `/plans`, `/organizations`, `/platform`). */
export const api = scoped("");

/** Chamadas públicas (sem sessão): login, cadastro, esqueci a senha, planos. */
export const publicApi = scoped("", false);

/** `/api/companies/:companyId/...` */
export const companyApi = (companyId: string) => scoped(`/companies/${companyId}`);

/** `/api/stores/:storeId/...` */
export const storeApi = (storeId: string) => scoped(`/stores/${storeId}`);
