import "server-only";
import type { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  COOKIE_BASE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
} from "./config";

/** Par de tokens devolvido pelo backend (login, cadastro, troca de senha e refresh). */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
}

export function isTokenPair(value: unknown): value is TokenPair {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.access_token === "string" &&
    typeof v.refresh_token === "string" &&
    typeof v.expires_in === "number"
  );
}

/** Grava os dois tokens em cookies httpOnly. O JavaScript da página nunca os enxerga. */
export function setSessionCookies(response: NextResponse, pair: TokenPair) {
  // O cookie do access token expira um pouco antes do próprio token.
  const accessMaxAge = Math.max(pair.expires_in - 15, 1);
  response.cookies.set(ACCESS_COOKIE, pair.access_token, {
    ...COOKIE_BASE,
    maxAge: accessMaxAge,
  });
  response.cookies.set(REFRESH_COOKIE, pair.refresh_token, {
    ...COOKIE_BASE,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
}
