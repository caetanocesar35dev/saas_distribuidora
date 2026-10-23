import "server-only";

/** URL da API do NestJS. Só o servidor do Next conhece: o navegador nunca fala direto com ela. */
export const API_URL = (process.env.API_URL ?? "http://localhost:3001/api").replace(
  /\/+$/,
  "",
);

export const ACCESS_COOKIE = "sd_at";
export const REFRESH_COOKIE = "sd_rt";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export const REFRESH_COOKIE_MAX_AGE = THIRTY_DAYS;
