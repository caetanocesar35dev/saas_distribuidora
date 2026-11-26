import { describe, expect, it } from "vitest";
import { cartSubtotal } from "@/app/loja/[storeId]/pdv/cart";
import type { StoreProduct } from "@/lib/api/types";
import {
  defaultUnitPrice,
  draftFromOffer,
  itemTotal,
  looseUnits,
  packCostFromUnit,
  resolvePrices,
  unitCostFromPack,
} from "./pack-pricing";

describe("valor do item", () => {
  it("embalagem com preço próprio e unidades avulsas com o preço da unidade", () => {
    // 2 maços de 20 a R$ 12,00 + 3 cigarros a R$ 1,00
    expect(
      itemTotal({ quantity: 43, packs: 2, packSize: 20, price: 1, packPrice: 12 }),
    ).toBe(27);
  });

  it("sem preço próprio, a embalagem é unidade × quantidade", () => {
    expect(
      itemTotal({ quantity: 27, packs: 2, packSize: 12, price: 4.5, packPrice: null }),
    ).toBe(121.5);
  });

  it("sem embalagem, é só unidade × quantidade", () => {
    expect(itemTotal({ quantity: 3, packs: 0, packSize: null, price: 4.5, packPrice: null })).toBe(
      13.5,
    );
  });

  it("unidades avulsas do item (o contador da comanda)", () => {
    expect(looseUnits({ quantity: 43, packs: 2, packSize: 20 })).toBe(3);
    expect(looseUnits({ quantity: 5, packs: 0, packSize: null })).toBe(5);
  });

  it("o carrinho usa a mesma conta", () => {
    const item = {
      id: "c",
      price: 1,
      packPrice: 12,
      product: { packQuantity: 20 },
    } as unknown as StoreProduct;
    expect(cartSubtotal([{ item, quantity: 3, packs: 2 }])).toBe(27);
  });
});

describe("preço e custo a partir da embalagem", () => {
  it("a unidade é o preço da embalagem ÷ quantidade, em centavos", () => {
    expect(defaultUnitPrice(12, 20)).toBe(0.6);
    expect(defaultUnitPrice(12.5, 20)).toBe(0.63);
  });

  it("o custo da unidade guarda 4 casas e volta ao custo da embalagem", () => {
    expect(unitCostFromPack(9.5, 20)).toBe(0.475);
    expect(packCostFromUnit(0.475, 20)).toBe(9.5);
    expect(packCostFromUnit(unitCostFromPack(10, 12), 12)).toBe(10);
  });
});

describe("formulário de preço", () => {
  it("unidade vazia é calculada; preenchida vale o que foi digitado", () => {
    expect(resolvePrices({ packPrice: 12, cost: 9.5 }, 20)).toEqual({
      price: 0.6,
      packPrice: 12,
      costPrice: 0.475,
    });
    expect(resolvePrices({ packPrice: 12, unitPrice: 1 }, 20)).toMatchObject({
      price: 1,
      packPrice: 12,
    });
  });

  it("produto sem embalagem ignora o preço dela e o custo é da unidade", () => {
    expect(resolvePrices({ packPrice: 12, unitPrice: 5, cost: 3 }, 1)).toEqual({
      price: 5,
      packPrice: undefined,
      costPrice: 3,
    });
  });

  it("sem preço nenhum, falta informar", () => {
    expect(resolvePrices({}, 20).price).toBeUndefined();
  });

  it("a loja sem preço próprio usa o padrão do formulário", () => {
    expect(resolvePrices({}, 20, { packPrice: 12, cost: 10 })).toEqual({
      price: 0.6,
      packPrice: 12,
      costPrice: 0.5,
    });
    expect(resolvePrices({ packPrice: 13 }, 20, { packPrice: 12 }).packPrice).toBe(13);
  });

  it("ao abrir, a unidade igual ao padrão fica vazia e a diferente aparece", () => {
    expect(draftFromOffer({ price: 0.6, packPrice: 12, costPrice: 0.475 }, 20)).toEqual({
      packPrice: 12,
      unitPrice: undefined,
      cost: 9.5,
    });
    expect(draftFromOffer({ price: 1, packPrice: 12 }, 20).unitPrice).toBe(1);
    expect(draftFromOffer({ price: 4.5, packPrice: null, costPrice: 3 }, 12)).toEqual({
      packPrice: undefined,
      unitPrice: 4.5,
      cost: 36,
    });
    expect(draftFromOffer({ price: 5, packPrice: null, costPrice: 3 }, 1)).toEqual({
      unitPrice: 5,
      cost: 3,
    });
  });
});
