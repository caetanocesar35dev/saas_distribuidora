import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callPublic,
  callWithSession,
  finishSessionStart,
  hasForeignOrigin,
  respond,
} from "./bff";

function req(options: { method?: string; headers?: Record<string, string>; cookie?: string } = {}) {
  const headers = new Headers({ host: "localhost:3000", ...options.headers });
  if (options.cookie) headers.set("cookie", options.cookie);
  return new NextRequest("http://localhost:3000/api/x", { method: options.method ?? "POST", headers });
}

const pair = (n: number) => ({
  access_token: `access-${n}`,
  refresh_token: `refresh-${n}`,
  token_type: "Bearer",
  expires_in: 900,
});

describe("BFF: conferência de origem (CSRF)", () => {
  it("leituras e requisições sem Origin passam", () => {
    expect(hasForeignOrigin(req({ method: "GET", headers: { origin: "https://x.com" } }))).toBe(false);
    expect(hasForeignOrigin(req())).toBe(false);
  });

  it("escrita vinda da própria página passa; de outro site é recusada", () => {
    expect(hasForeignOrigin(req({ headers: { origin: "http://localhost:3000" } }))).toBe(false);
    expect(hasForeignOrigin(req({ headers: { origin: "https://site-malicioso.com" } }))).toBe(true);
    expect(hasForeignOrigin(req({ headers: { origin: "lixo" } }))).toBe(true);
  });

  it("atrás de proxy reverso vale o host repassado", () => {
    const behindProxy = req({
      headers: { origin: "https://app.exemplo.com", host: "interno:3000", "x-forwarded-host": "app.exemplo.com" },
    });
    expect(hasForeignOrigin(behindProxy)).toBe(false);
  });
});

describe("BFF: chamadas ao backend com sessão", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("manda o access token do cookie no cabeçalho Authorization", async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true }));
    const result = await callWithSession(req({ cookie: "sd_at=meu-access; sd_rt=meu-refresh" }), "/me", {
      method: "GET",
    });
    expect(result.status).toBe(200);
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer meu-access");
    expect(result.renewed).toBeUndefined();
  });

  it("sem o cookie do access token (expirou), renova antes de chamar", async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith("/auth/refresh") ? json(200, pair(1)) : json(200, { ok: true }),
    );
    const result = await callWithSession(req({ cookie: "sd_rt=refresh-bff-a" }), "/me", {
      method: "GET",
    });
    expect(result.status).toBe(200);
    expect(result.renewed).toEqual(pair(1));
    const last = fetchMock.mock.calls.at(-1)?.[1]?.headers as Record<string, string>;
    expect(last.Authorization).toBe("Bearer access-1");
  });

  it("401 do backend: renova uma vez e repete a chamada", async () => {
    let apiCalls = 0;
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/auth/refresh")) return json(200, pair(2));
      apiCalls += 1;
      return apiCalls === 1 ? json(401, { statusCode: 401 }) : json(200, { ok: true });
    });
    const result = await callWithSession(
      req({ cookie: "sd_at=vencido; sd_rt=refresh-bff-b" }),
      "/me",
      { method: "GET" },
    );
    expect(result.status).toBe(200);
    expect(result.renewed).toEqual(pair(2));
    expect(apiCalls).toBe(2);
  });

  it("refresh recusado: a sessão acabou e os cookies devem ser apagados", async () => {
    fetchMock.mockImplementation(async () => json(401, { statusCode: 401 }));
    const result = await callWithSession(req({ cookie: "sd_rt=refresh-bff-c" }), "/me", {
      method: "GET",
    });
    expect(result.status).toBe(401);
    expect(result.sessionEnded).toBe(true);

    const response = respond(result);
    const setCookie = response.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/sd_at=;/);
    expect(setCookie).toMatch(/sd_rt=;/);
  });

  it("401 mesmo com o token novo (usuário desativado): apaga a sessão", async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith("/auth/refresh") ? json(200, pair(3)) : json(401, { statusCode: 401 }),
    );
    const result = await callWithSession(
      req({ cookie: "sd_at=x; sd_rt=refresh-bff-d" }),
      "/me",
      { method: "GET" },
    );
    expect(result.status).toBe(401);
    expect(result.sessionEnded).toBe(true);
  });

  it("backend fora do ar vira 502 em português, sem vazar detalhes", async () => {
    fetchMock.mockRejectedValue(new TypeError("connect ECONNREFUSED 127.0.0.1:3001"));
    const result = await callPublic(req(), "/plans", { method: "GET" });
    expect(result.status).toBe(502);
    expect(result.text).toMatch(/Não foi possível falar com o servidor/);
    expect(result.text).not.toMatch(/ECONNREFUSED/);
  });
});

describe("BFF: login, cadastro e troca de senha", () => {
  it("os tokens vão para cookies httpOnly e o navegador recebe só o usuário", async () => {
    const user = { id: "u1", name: "Maria", email: "m@x.com", platformRole: null };
    const response = finishSessionStart({
      status: 200,
      contentType: "application/json",
      text: JSON.stringify({ ...pair(1), user }),
    });
    expect(await response.json()).toEqual({ user });

    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=lax/i);
    }
    expect(cookies.join("\n")).toContain("sd_at=access-1");
    expect(cookies.join("\n")).toContain("sd_rt=refresh-1");
    // o cookie do access token expira antes do próprio token
    expect(cookies.find((c) => c.startsWith("sd_at="))).toMatch(/Max-Age=885/);
  });

  it("erro do backend (senha errada) passa direto, sem cookie", async () => {
    const response = finishSessionStart({
      status: 401,
      contentType: "application/json",
      text: JSON.stringify({ statusCode: 401, message: "E-mail ou senha incorretos." }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it("sucesso sem tokens é erro do servidor (nunca devolve o corpo cru)", async () => {
    const response = finishSessionStart({ status: 200, contentType: "application/json", text: "{}" });
    expect(response.status).toBe(502);
  });
});
