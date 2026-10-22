import { NextResponse, type NextRequest } from "next/server";

/**
 * Guarda de páginas: sem sessão (cookie do refresh token), só as páginas públicas abrem. Isto é
 * conveniência de navegação; quem de fato valida a sessão é o backend, a cada chamada.
 */
const REFRESH_COOKIE = "sd_rt";

const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/esqueci-a-senha",
  "/redefinir-senha",
  "/duvidas",
  "/termos",
  "/privacidade",
];
// Quem já está logado não precisa ver estas telas (redefinir-senha e dúvidas continuam abertas).
const GUEST_ONLY = ["/login", "/cadastro", "/esqueci-a-senha"];

const matches = (pathname: string, bases: string[]) =>
  bases.some((b) => pathname === b || pathname.startsWith(`${b}/`));

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(REFRESH_COOKIE);

  if (!hasSession && !matches(pathname, PUBLIC_PATHS)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (hasSession && matches(pathname, GUEST_ONLY)) {
    const url = req.nextUrl.clone();
    url.pathname = "/selecionar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Tudo, menos a API (BFF), os arquivos internos do Next e arquivos estáticos.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\..*).*)"],
};
