import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, API_URL, REFRESH_COOKIE } from "./config";
import { refreshSession, type ClientMeta } from "./refresh";
import {
  clearSessionCookies,
  isTokenPair,
  setSessionCookies,
  type TokenPair,
} from "./session";

export interface UpstreamResult {
  status: number;
  contentType: string | null;
  text: string;
  /** Par novo, quando a sessão foi renovada durante a chamada. */
  renewed?: TokenPair;
  /** A sessão acabou (renovação recusada ou 401 final): os cookies devem ser apagados. */
  sessionEnded?: boolean;
}

export function clientMeta(req: NextRequest): ClientMeta {
  return {
    userAgent: req.headers.get("user-agent"),
    forwardedFor: req.headers.get("x-forwarded-for"),
  };
}

interface CallInit {
  method: string;
  body?: string;
  accessToken?: string;
  meta: ClientMeta;
  contentType?: string | null;
}

async function callBackend(path: string, init: CallInit): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) {
    headers["Content-Type"] = init.contentType ?? "application/json";
  }
  if (init.accessToken) headers.Authorization = `Bearer ${init.accessToken}`;
  if (init.meta.userAgent) headers["User-Agent"] = init.meta.userAgent;
  if (init.meta.forwardedFor) {
    headers["X-Forwarded-For"] = init.meta.forwardedFor;
  }
  return fetch(`${API_URL}${path}`, {
    method: init.method,
    headers,
    body: init.body,
    cache: "no-store",
    redirect: "manual",
  });
}

async function toResult(res: Response): Promise<UpstreamResult> {
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    text: res.status === 204 ? "" : await res.text(),
  };
}

const BAD_GATEWAY = JSON.stringify({
  statusCode: 502,
  message: "Não foi possível falar com o servidor. Tente novamente em instantes.",
});

/** Chamada sem sessão (login, cadastro, esqueci a senha, planos...). */
export async function callPublic(
  req: NextRequest,
  path: string,
  init: { method: string; body?: string },
): Promise<UpstreamResult> {
  try {
    const res = await callBackend(path, { ...init, meta: clientMeta(req) });
    return await toResult(res);
  } catch {
    return { status: 502, contentType: "application/json", text: BAD_GATEWAY };
  }
}

/**
 * Chamada com a sessão dos cookies. Se o access token acabou (cookie ausente) ou o backend
 * responde 401, renova uma única vez com o refresh token e repete a chamada.
 */
export async function callWithSession(
  req: NextRequest,
  path: string,
  init: { method: string; body?: string; contentType?: string | null },
): Promise<UpstreamResult> {
  const meta = clientMeta(req);
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  let accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  let renewed: TokenPair | undefined;

  const renew = async (): Promise<boolean> => {
    if (!refreshToken) return false;
    const result = await refreshSession(refreshToken, meta);
    if (!result.ok) return false;
    renewed = result.pair;
    accessToken = result.pair.access_token;
    return true;
  };

  try {
    if (!accessToken && refreshToken) {
      if (!(await renew())) return sessionEnded();
    }

    let res = await callBackend(path, { ...init, accessToken, meta });
    if (res.status === 401 && refreshToken && !renewed) {
      if (!(await renew())) return sessionEnded();
      res = await callBackend(path, { ...init, accessToken, meta });
    }

    const result = await toResult(res);
    result.renewed = renewed;
    // 401 mesmo com o token novo (ex.: usuário desativado): a sessão não serve mais.
    if (res.status === 401 && (refreshToken || accessToken)) {
      result.sessionEnded = true;
    }
    return result;
  } catch {
    return { status: 502, contentType: "application/json", text: BAD_GATEWAY };
  }
}

function sessionEnded(): UpstreamResult {
  return {
    status: 401,
    contentType: "application/json",
    text: JSON.stringify({
      statusCode: 401,
      message: "Sua sessão expirou. Entre novamente.",
    }),
    sessionEnded: true,
  };
}

/** Converte o resultado em resposta HTTP, aplicando os cookies novos ou limpando a sessão. */
export function respond(result: UpstreamResult): NextResponse {
  const noBody = result.status === 204 || result.status === 304;
  const response = new NextResponse(noBody ? null : result.text, {
    status: result.status,
    headers: {
      "Content-Type": result.contentType ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
  if (result.renewed) setSessionCookies(response, result.renewed);
  if (result.sessionEnded) clearSessionCookies(response);
  return response;
}

export function json(
  body: unknown,
  status = 200,
  mutate?: (response: NextResponse) => void,
): NextResponse {
  const response = NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
  mutate?.(response);
  return response;
}

/**
 * Resposta de login, cadastro e troca de senha: o backend devolve os tokens, que vão para os
 * cookies httpOnly; o navegador recebe só o usuário.
 */
export function finishSessionStart(result: UpstreamResult): NextResponse {
  if (result.status >= 200 && result.status < 300) {
    try {
      const body: unknown = JSON.parse(result.text);
      if (isTokenPair(body)) {
        const user = (body as unknown as { user?: unknown }).user ?? null;
        return json({ user }, result.status, (res) => {
          setSessionCookies(res, body);
        });
      }
    } catch {
      // cai no repasse abaixo
    }
    return json(
      { statusCode: 502, message: "Resposta inesperada do servidor." },
      502,
    );
  }
  return respond(result);
}

/**
 * Defesa extra contra CSRF (além do SameSite=Lax dos cookies): requisições que gravam só valem se
 * vierem da própria página. Sem cabeçalho Origin (ferramentas, testes) a requisição passa.
 */
export function hasForeignOrigin(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD") return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const own = [
      req.headers.get("x-forwarded-host"),
      req.headers.get("host"),
      req.nextUrl.host,
    ].filter((h): h is string => !!h);
    return !own.includes(originHost);
  } catch {
    return true;
  }
}

export function foreignOriginResponse(): NextResponse {
  return json(
    { statusCode: 403, message: "Origem da requisição não permitida." },
    403,
  );
}
