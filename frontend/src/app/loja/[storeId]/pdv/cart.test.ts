import { describe, expect, it } from "vitest";
import type { StoreProduct } from "@/lib/api/types";
import { cartBottles, cartReducer, cartSubtotal, type CartLine } from "./cart";

function product(
  id: string,
  price: number,
  bottle?: { id: string; name: string },
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
      packQuantity: 1,
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
