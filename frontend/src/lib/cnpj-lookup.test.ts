import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CNPJ_LOOKUP_URL,
  clearCnpjLookupCache,
  lookupCnpj,
  parseCnpjResponse,
} from "./cnpj-lookup";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const EMPTY_ADDRESS = {
  phone: null,
  zipCode: null,
  street: null,
  number: null,
  complement: null,
  neighborhood: null,
  city: null,
  state: null,
};

describe("parseCnpjResponse", () => {
  it("lê razão social, nome fantasia, endereço e telefone", () => {
    expect(
      parseCnpjResponse({
        razao_social: " Distribuidora X LTDA ",
        estabelecimento: {
          nome_fantasia: "Bebidas X",
          tipo_logradouro: "RUA",
          logradouro: "GARIBALDI",
          numero: "070",
          complemento: null,
          bairro: "VILA RICA",
          cep: "95760000",
          ddd1: "51",
          telefone1: "36354333",
          cidade: { nome: "São Sebastião do Caí" },
          estado: { sigla: "RS" },
        },
      }),
    ).toEqual({
      razaoSocial: "Distribuidora X LTDA",
      nomeFantasia: "Bebidas X",
      phone: "(51) 3635-4333",
      zipCode: "95760-000",
      street: "RUA GARIBALDI",
      number: "070",
      complement: null,
      neighborhood: "VILA RICA",
      city: "São Sebastião do Caí",
      state: "RS",
    });
  });

  it("dado ausente, vazio ou fora do formato vira null; sem razão social não há dados", () => {
    expect(
      parseCnpjResponse({ razao_social: "X SA", estabelecimento: { nome_fantasia: null } }),
    ).toEqual({ razaoSocial: "X SA", nomeFantasia: null, ...EMPTY_ADDRESS });
    expect(
      parseCnpjResponse({
        razao_social: "X SA",
        estabelecimento: {
          nome_fantasia: "  ",
          cep: "123",
          ddd1: "51",
          telefone1: null,
          estado: { sigla: "EX" },
        },
      }),
    ).toMatchObject({ nomeFantasia: null, zipCode: null, phone: null, state: "EX" });
    expect(
      parseCnpjResponse({ razao_social: "X SA", estabelecimento: { estado: { sigla: "XXX" } } })
        ?.state,
    ).toBeNull();
    expect(parseCnpjResponse({ razao_social: "X SA" })).toEqual({
      razaoSocial: "X SA",
      nomeFantasia: null,
      ...EMPTY_ADDRESS,
    });
    expect(parseCnpjResponse({ estabelecimento: {} })).toBeNull();
    expect(parseCnpjResponse(null)).toBeNull();
  });
});

describe("lookupCnpj", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearCnpjLookupCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("consulta sem máscara e em maiúsculas, sem cookies, e guarda o resultado", async () => {
    fetchMock.mockResolvedValue(json(200, { razao_social: "ABC SA", estabelecimento: {} }));
    const result = await lookupCnpj("12.abc.345/01de-35");
    expect(result).toEqual({
      status: "found",
      data: { razaoSocial: "ABC SA", nomeFantasia: null, ...EMPTY_ADDRESS },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${CNPJ_LOOKUP_URL}12ABC34501DE35`);
    expect(init?.credentials).toBe("omit");

    await lookupCnpj("12ABC34501DE35");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("404 é não encontrado; CNPJ inválido nem consulta", async () => {
    fetchMock.mockResolvedValue(json(404, { status: 404 }));
    expect(await lookupCnpj("11.222.333/0001-81")).toEqual({ status: "not-found" });
    expect(await lookupCnpj("11.222.333/0001-82")).toEqual({ status: "not-found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("limite (429) ou falha de rede ficam indisponíveis e não são guardados", async () => {
    fetchMock.mockResolvedValueOnce(json(429, { status: 429 }));
    expect(await lookupCnpj("11222333000181")).toEqual({ status: "unavailable" });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await lookupCnpj("11222333000181")).toEqual({ status: "unavailable" });
    fetchMock.mockResolvedValueOnce(json(200, { razao_social: "Y LTDA" }));
    expect((await lookupCnpj("11222333000181")).status).toBe("found");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
