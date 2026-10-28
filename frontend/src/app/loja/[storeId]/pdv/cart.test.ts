import { describe, expect, it } from "vitest";
import type { StoreProduct } from "@/lib/api/types";
import { cartBottles, cartReducer, cartSubtotal, lineUnits, type CartLine } from "./cart";

function product(
  id: string,
  price: number,
  bottle?: { id: string; name: string },
  packQuantity = 1,
): StoreProduct {
  return {
    id,
    storeId: "loja",
    productId: `p-${id}`,
    price,
    costPrice: 1,
    stock: 100,
    isActive: true,
    product: {
      code: id,
      name: `Produto ${id}`,
      packQuantity,
      bottleTypeId: bottle?.id ?? null,
      bottleType: bottle ?? null,
    },
  };
}

describe("carrinho do PDV", () => {
  it("adicionar o mesmo produto soma a quantidade", () => {
    const a = product("a", 2.5);
    let cart: CartLine[] = [];
    cart = cartReducer(cart, { type: "add", item: a });
    cart = cartReducer(cart, { type: "add", item: a });
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
  });

  it("quantidade nunca fica abaixo de 1 e remover tira a linha", () => {
    const a = product("a", 2.5);
    let cart = cartReducer([], { type: "add", item: a });
    cart = cartReducer(cart, { type: "set", id: "a", quantity: 0 });
    expect(cart[0].quantity).toBe(1);
    cart = cartReducer(cart, { type: "set", id: "a", quantity: 6 });
    expect(cart[0].quantity).toBe(6);
    cart = cartReducer(cart, { type: "remove", id: "a" });
    expect(cart).toEqual([]);
  });

  it("venda em lote: fardos e unidades na mesma linha, total em unidades", () => {
    const litrao = { id: "lit", name: "Litrão" };
    const fardo = product("f", 5, litrao, 12);
    let cart = cartReducer([], { type: "addPack", item: fardo });
    expect(cart[0]).toMatchObject({ quantity: 0, packs: 1 });
    expect(lineUnits(cart[0])).toBe(12);

    cart = cartReducer(cart, { type: "addPack", item: fardo });
    cart = cartReducer(cart, { type: "add", item: fardo });
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ quantity: 1, packs: 2 });
    expect(lineUnits(cart[0])).toBe(25);
    expect(cartSubtotal(cart)).toBe(125); // fardo = unidade × 12
    expect(cartBottles(cart)).toEqual([{ bottleTypeId: "lit", name: "Litrão", taken: 25 }]);

    // com fardos, as unidades avulsas podem ir a zero; sem fardos, volta a 1 unidade
    cart = cartReducer(cart, { type: "set", id: "f", quantity: 0 });
    expect(cart[0]).toMatchObject({ quantity: 0, packs: 2 });
    cart = cartReducer(cart, { type: "setPacks", id: "f", packs: 0 });
    expect(cart[0]).toMatchObject({ quantity: 1, packs: 0 });
    cart = cartReducer(cart, { type: "setPacks", id: "f", packs: -3 });
    expect(cart[0].packs).toBe(0);
  });

  it("limpar esvazia o carrinho", () => {
    const cart = cartReducer([{ item: product("a", 1), quantity: 3 }], { type: "clear" });
    expect(cart).toEqual([]);
  });

  it("subtotal arredonda cada linha em centavos (sem erro de ponto flutuante)", () => {
    const cart: CartLine[] = [
      { item: product("a", 0.1), quantity: 3 },
      { item: product("b", 0.2), quantity: 3 },
    ];
    expect(cartSubtotal(cart)).toBe(0.9);
    expect(cartSubtotal([])).toBe(0);
  });

  it("vasilhames: um por unidade, somados por tipo", () => {
    const litrao = { id: "lit", name: "Litrão" };
    const cart: CartLine[] = [
      { item: product("a", 14, litrao), quantity: 2 },
      { item: product("b", 15, litrao), quantity: 1 },
      { item: product("c", 2.5), quantity: 5 },
    ];
    expect(cartBottles(cart)).toEqual([{ bottleTypeId: "lit", name: "Litrão", taken: 3 }]);
    expect(cartBottles([{ item: product("c", 2.5), quantity: 5 }])).toEqual([]);
  });
});
