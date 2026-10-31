import { describe, expect, it } from "vitest";
import { choosablePlans, planFit, planLimits } from "./plans";

const company = (storeCount: number, nomeFantasia = "Loja X") => ({
  id: nomeFantasia,
  razaoSocial: `${nomeFantasia} LTDA`,
  nomeFantasia,
  storeCount,
});

describe("planLimits", () => {
  it("descreve os limites, com ilimitado e singular", () => {
    expect(planLimits({ maxCompanies: 1, maxStoresPerCompany: 1 })).toBe(
      "1 empresa · 1 loja por empresa",
    );
    expect(planLimits({ maxCompanies: 3, maxStoresPerCompany: 10 })).toBe(
      "3 empresas · até 10 lojas por empresa",
    );
    expect(planLimits({ maxCompanies: null, maxStoresPerCompany: null })).toBe(
      "empresas ilimitadas · lojas ilimitadas",
    );
  });
});

describe("planFit", () => {
  it("cabe quando empresas e lojas estão dentro do limite (ou é ilimitado)", () => {
    expect(planFit({ maxCompanies: 1, maxStoresPerCompany: 3 }, [company(3)])).toBeNull();
    expect(planFit({ maxCompanies: null, maxStoresPerCompany: null }, [company(40)])).toBeNull();
  });

  it("não cabe com mais empresas que o plano", () => {
    expect(
      planFit({ maxCompanies: 1, maxStoresPerCompany: null }, [company(1, "A"), company(1, "B")]),
    ).toBe("Permite 1 empresa(s) e você tem 2.");
  });

  it("não cabe se alguma empresa tem mais lojas que o plano, e diz qual", () => {
    expect(
      planFit({ maxCompanies: 3, maxStoresPerCompany: 1 }, [company(1, "A"), company(2, "B")]),
    ).toBe("Permite 1 loja(s) por empresa e B tem 2.");
  });
});

describe("choosablePlans", () => {
  it("tira o plano gratuito (o do teste) e ordena pelo preço", () => {
    const plan = (name: string, priceInCents: number) => ({
      id: name,
      name,
      priceInCents,
      maxCompanies: null,
      maxStoresPerCompany: null,
    });
    expect(
      choosablePlans([plan("Rede", 59900), plan("Trial", 0), plan("Essencial", 9900)]).map(
        (p) => p.name,
      ),
    ).toEqual(["Essencial", "Rede"]);
  });
});
