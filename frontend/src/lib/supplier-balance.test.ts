import { describe, expect, it } from "vitest";
import { supplierBalanceText } from "./supplier-balance";

describe("supplierBalanceText", () => {
  it("recebeu mais do que enviou: a loja deve", () => {
    expect(supplierBalanceText(18)).toEqual({ text: "A loja deve 18 cascos", tone: "owe" });
    expect(supplierBalanceText(1).text).toBe("A loja deve 1 casco");
  });

  it("enviou mais do que recebeu: o fornecedor deve", () => {
    expect(supplierBalanceText(-5)).toEqual({ text: "O fornecedor deve 5 cascos", tone: "owed" });
    expect(supplierBalanceText(-1).text).toBe("O fornecedor deve 1 casco");
  });

  it("zero: em dia", () => {
    expect(supplierBalanceText(0)).toEqual({ text: "Em dia", tone: "even" });
  });
});
