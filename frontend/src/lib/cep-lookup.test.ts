import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CEP_LOOKUP_URL,
  clearCepLookupCache,
  lookupCep,
  maskCep,
  parseCepResponse,
} from "./cep-lookup";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("máscara do CEP", () => {
  it("aplica 00000-000 e ignora o que não é número", () => {
    expect(maskCep("50030230")).toBe("50030-230");
    expect(maskCep("50030")).toBe("50030");
    expect(maskCep("5003-0230x99")).toBe("50030-230");
  });
});

describe("parseCepResponse", () => {
  it("lê rua, bairro, cidade e UF", () => {
    expect(
      parseCepResponse({
        logradouro: "Rua da Aurora",
        bairro: "Boa Vista",
        localidade: "Recife",
        uf: "PE",
      }),
    ).toEqual({
      street: "Rua da Aurora",
      neighborhood: "Boa Vista",
      city: "Recife",
      state: "PE",
    });
  });

  it("CEP geral (só cidade) serve; CEP inexistente ou resposta estranha não", () => {
    expect(
      parseCepResponse({ logradouro: "", bairro: "", localidade: "Pombos", uf: "pe" }),
    ).toEqual({ street: null, neighborhood: null, city: "Pombos", state: "PE" });
    expect(parseCepResponse({ erro: true })).toBeNull();
    expect(parseCepResponse({ localidade: "", logradouro: "" })).toBeNull();
    expect(parseCepResponse(null)).toBeNull();
  });
});

describe("lookupCep", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearCepLookupCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("consulta só com 8 dígitos, sem cookies, e guarda o resultado", async () => {
    fetchMock.mockResolvedValue(
      json(200, { logradouro: "Rua A", bairro: "Centro", localidade: "Recife", uf: "PE" }),
    );
    expect(await lookupCep("5003")).toEqual({ status: "not-found" });
    expect(fetchMock).not.toHaveBeenCalled();

    const result = await lookupCep("50030-230");
    expect(result.status).toBe("found");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${CEP_LOOKUP_URL}50030230/json/`);
    expect(init?.credentials).toBe("omit");
    await lookupCep("50030230");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("CEP inexistente é não encontrado (e guardado); falha de rede fica indisponível", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { erro: true }));
    expect(await lookupCep("99999999")).toEqual({ status: "not-found" });
    expect(await lookupCep("99999999")).toEqual({ status: "not-found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await lookupCep("11111111")).toEqual({ status: "unavailable" });
    fetchMock.mockResolvedValueOnce(json(200, { localidade: "Olinda", uf: "PE" }));
    expect((await lookupCep("11111111")).status).toBe("found");
  });
});
