import "server-only";
import { API_URL } from "./config";
import { isTokenPair, type TokenPair } from "./session";

export type RefreshResult =
  | { ok: true; pair: TokenPair }
  | { ok: false; status: number };

interface RefreshState {
  inflight: Map<string, Promise<RefreshResult>>;
  recent: Map<string, { result: RefreshResult; at: number }>;
}

// O refresh token do backend é de uso único: se duas requisições paralelas tentarem renovar com o
// mesmo token, a segunda "reusa" um token gasto e o backend derruba a sessão inteira. Por isso a
// renovação é feita uma vez só por token (fila) e o resultado fica guardado por alguns segundos
// para as requisições que já saíram do navegador com os cookies antigos. Fica em globalThis
// porque o Next pode instanciar este módulo mais de uma vez (rotas e HMR).
const globalKey = Symbol.for("sd.refresh.state");
type GlobalWithState = typeof globalThis & { [globalKey]?: RefreshState };
const g = globalThis as GlobalWithState;
const state: RefreshState = (g[globalKey] ??= {
  inflight: new Map(),
  recent: new Map(),
});

const RECENT_TTL_MS = 60_000;

function pruneRecent(now: number) {
  for (const [key, entry] of state.recent) {
    if (now - entry.at > RECENT_TTL_MS) state.recent.delete(key);
  }
}

export interface ClientMeta {
  userAgent?: string | null;
  forwardedFor?: string | null;
}

async function callRefresh(
  refreshToken: string,
  meta: ClientMeta,
): Promise<RefreshResult> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(meta.userAgent ? { "User-Agent": meta.userAgent } : {}),
        ...(meta.forwardedFor ? { "X-Forwarded-For": meta.forwardedFor } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status };
    const body: unknown = await res.json();
    if (!isTokenPair(body)) return { ok: false, status: 502 };
    return { ok: true, pair: body };
  } catch {
    return { ok: false, status: 503 };
  }
}

/**
 * Renova a sessão com o refresh token. Chamadas simultâneas com o mesmo token compartilham a
 * mesma renovação; falhas de rede (503) não ficam guardadas, para a próxima requisição tentar.
 */
export async function refreshSession(
  refreshToken: string,
  meta: ClientMeta,
): Promise<RefreshResult> {
  const now = Date.now();
  pruneRecent(now);

  const recent = state.recent.get(refreshToken);
  if (recent) return recent.result;

  const pending = state.inflight.get(refreshToken);
  if (pending) return pending;

  const promise = callRefresh(refreshToken, meta).then((result) => {
    state.inflight.delete(refreshToken);
    if (result.ok || result.status === 401) {
      state.recent.set(refreshToken, { result, at: Date.now() });
    }
    return result;
  });
  state.inflight.set(refreshToken, promise);
  return promise;
}
