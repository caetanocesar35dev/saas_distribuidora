import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiEvents, errorMessage, request } from "./client";

function respond(status: number, body: unknown) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("cliente da API", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("monta a URL com a query e ignora valores vazios", async () => {
    fetchMock.mockImplementation(async () => respond(200, { ok: true }));
    await request("GET", "/stores/s1/sales", {
      query: { page: 2, search: "", startDate: undefined, status: "COMPLETED", flag: false },
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe("/api/stores/s1/sales?page=2&status=COMPLETED&flag=false");
  });

  it("envia JSON só quando há corpo", async () => {
    fetchMock.mockImplementation(async () => respond(200, {}));
    await request("POST", "/x", { body: { a: 1 } });
    await request("POST", "/y");
    const [, withBody] = fetchMock.mock.calls[0];
    const [, withoutBody] = fetchMock.mock.calls[1];
    expect(withBody?.body).toBe('{"a":1}');
    expect(withBody?.headers).toEqual({ "Content-Type": "application/json" });
    expect(withoutBody?.body).toBeUndefined();
  });

  it("resposta vazia (caixa fechado) vira null", async () => {
    fetchMock.mockImplementation(async () => new Response("", { status: 200 }));
    await expect(request("GET", "/stores/s1/cash-register/current")).resolves.toBeNull();
  });

  it("erro de validação (400) traz várias mensagens", async () => {
    fetchMock.mockImplementation(async () => respond(400, { statusCode: 400, message: ["Nome inválido.", "E-mail inválido."] }));
    const error = await request("POST", "/x", { body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).messages).toEqual(["Nome inválido.", "E-mail inválido."]);
    expect(errorMessage(error)).toBe("Nome inválido. E-mail inválido.");
  });

  it("429 vira mensagem em português (o limitador responde em inglês)", async () => {
    fetchMock.mockImplementation(async () => respond(429, { statusCode: 429, message: "ThrottlerException: Too Many Requests" }));
    const error = (await request("POST", "/auth/login", { session: false }).catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(429);
    expect(error.message).toMatch(/Muitas tentativas/);
  });

  it("sem conexão: mensagem amigável e status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const error = (await request("GET", "/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/Sem conexão/);
  });

  it("401 avisa a sessão expirada, a menos que seja uma chamada pública (login)", async () => {
    const onUnauthorized = vi.fn();
    const off = apiEvents.onUnauthorized(onUnauthorized);
    fetchMock.mockImplementation(async () => respond(401, { statusCode: 401, message: "E-mail ou senha incorretos." }));

    await request("POST", "/auth/login", { body: {}, session: false }).catch(() => undefined);
    expect(onUnauthorized).not.toHaveBeenCalled();

    await request("GET", "/me").catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    off();
  });

  it("402 de somente leitura avisa a interface e expõe o código", async () => {
    const onReadOnly = vi.fn();
    const off = apiEvents.onReadOnly(onReadOnly);
    fetchMock.mockResolvedValue(
      respond(402, {
        statusCode: 402,
        code: "SUBSCRIPTION_READ_ONLY",
        reason: "TRIAL_EXPIRED",
        message: "O período de teste terminou.",
      }),
    );
    const error = (await request("POST", "/stores/s1/sales", { body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(error.isReadOnly).toBe(true);
    expect(error.reason).toBe("TRIAL_EXPIRED");
    expect(onReadOnly).toHaveBeenCalledTimes(1);
    off();
  });
});
