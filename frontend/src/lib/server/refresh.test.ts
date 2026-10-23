import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshSession } from "./refresh";

function pair(n: number) {
  return {
    access_token: `access-${n}`,
    refresh_token: `refresh-${n}`,
    token_type: "Bearer",
    expires_in: 900,
  };
}

describe("renovação da sessão em fila", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let counter = 0;

  beforeEach(() => {
    counter = 0;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("6 chamadas simultâneas com o mesmo refresh token renovam uma vez só", async () => {
    fetchMock.mockImplementation(async () => {
      counter += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(JSON.stringify(pair(counter)), { status: 200 });
    });

    const results = await Promise.all(
      Array.from({ length: 6 }, () => refreshSession("refresh-fila", {})),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result).toEqual({ ok: true, pair: pair(1) });
    }
  });

  it("depois de renovar, quem chega com o refresh token antigo recebe o mesmo par (sem reusar o token gasto)", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(pair(7)), { status: 200 }));
    await refreshSession("refresh-antigo", {});
    const late = await refreshSession("refresh-antigo", {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(late).toEqual({ ok: true, pair: pair(7) });
  });

  it("token recusado (401) é lembrado: não insiste e derrubaria a sessão", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 401 }));
    const first = await refreshSession("refresh-morto", {});
    const second = await refreshSession("refresh-morto", {});

    expect(first).toEqual({ ok: false, status: 401 });
    expect(second).toEqual({ ok: false, status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falha de rede não fica guardada: a próxima tentativa chama de novo", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(pair(9)), { status: 200 }));

    const first = await refreshSession("refresh-rede", {});
    const second = await refreshSession("refresh-rede", {});

    expect(first).toEqual({ ok: false, status: 503 });
    expect(second).toEqual({ ok: true, pair: pair(9) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resposta fora do formato esperado é tratada como erro do servidor", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ foo: 1 }), { status: 200 }));
    expect(await refreshSession("refresh-estranho", {})).toEqual({ ok: false, status: 502 });
  });

  it("repassa o IP e o navegador do cliente para o rate limit do backend", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(pair(1)), { status: 200 }));
    await refreshSession("refresh-meta", { userAgent: "Chrome", forwardedFor: "203.0.113.5" });
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-Forwarded-For"]).toBe("203.0.113.5");
    expect(headers["User-Agent"]).toBe("Chrome");
  });
});
