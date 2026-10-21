import type { NextRequest } from "next/server";
import {
  callPublic,
  callWithSession,
  foreignOriginResponse,
  hasForeignOrigin,
  respond,
} from "@/lib/server/bff";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server/config";

/**
 * Repassa toda chamada do navegador (`/api/...`) para a API do backend, colocando o access token
 * (guardado em cookie httpOnly) no cabeçalho Authorization e renovando a sessão quando preciso.
 * Rotas que mexem com tokens (login, cadastro, logout, troca de senha) têm handlers próprios.
 */

// O navegador não renova a sessão: quem faz isso é este servidor.
const BLOCKED = new Set(["auth/refresh"]);

async function handle(
  req: NextRequest,
  ctx: RouteContext<"/api/[...path]">,
) {
  if (hasForeignOrigin(req)) return foreignOriginResponse();
  const { path } = await ctx.params;
  const joined = path.join("/");
  if (BLOCKED.has(joined) || path.some((s) => s === "." || s === "..")) {
    return respond({
      status: 404,
      contentType: "application/json",
      text: JSON.stringify({ statusCode: 404, message: "Rota não encontrada." }),
    });
  }

  const target = `/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const hasBody = !["GET", "HEAD", "DELETE"].includes(req.method);
  const body = hasBody ? await req.text() : undefined;
  const init = {
    method: req.method,
    body: body === "" ? undefined : body,
    contentType: req.headers.get("content-type"),
  };

  const hasSession =
    req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);
  const result = hasSession
    ? await callWithSession(req, target, init)
    : await callPublic(req, target, init);
  return respond(result);
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
