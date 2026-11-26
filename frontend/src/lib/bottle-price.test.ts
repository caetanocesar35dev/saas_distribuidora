import { describe, expect, it } from "vitest";
import { cascoPriceSource } from "./bottle-price";

describe("preço do casco na loja", () => {
  it("o preço da loja vence o da empresa", () => {
    expect(cascoPriceSource({ storePrice: 3.5, companyPrice: 3 })).toBe("store");
    expect(cascoPriceSource({ storePrice: 2, companyPrice: null })).toBe("store");
  });

  it("sem preço da loja vale o da empresa; sem nenhum, o casco não é vendido", () => {
    expect(cascoPriceSource({ storePrice: null, companyPrice: 3 })).toBe("company");
    expect(cascoPriceSource({ storePrice: null, companyPrice: null })).toBe("none");
  });
});
