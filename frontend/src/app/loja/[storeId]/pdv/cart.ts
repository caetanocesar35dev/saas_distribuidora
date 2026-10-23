import type { StoreProduct } from "@/lib/api/types";
import type { BottleLine } from "@/components/app/pos/checkout-dialog";
import { roundMoney } from "@/lib/format";

export interface CartLine {
  item: StoreProduct;
  quantity: number;
}

export type CartAction =
  | { type: "add"; item: StoreProduct }
  | { type: "set"; id: string; quantity: number }
  | { type: "remove"; id: string }
  | { type: "clear" };

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add": {
      const existing = state.find((l) => l.item.id === action.item.id);
      if (existing) {
        return state.map((l) =>
          l.item.id === action.item.id ? { ...l, item: action.item, quantity: l.quantity + 1 } : l,
        );
      }
      return [...state, { item: action.item, quantity: 1 }];
    }
    case "set":
      return state.map((l) =>
        l.item.id === action.id ? { ...l, quantity: Math.max(1, action.quantity) } : l,
      );
    case "remove":
      return state.filter((l) => l.item.id !== action.id);
    case "clear":
      return [];
  }
}

/** Prévia do subtotal (o valor oficial é o que o backend devolve ao concluir a venda). */
export function cartSubtotal(lines: CartLine[]): number {
  return roundMoney(
    lines.reduce((sum, l) => sum + roundMoney(l.item.price * l.quantity), 0),
  );
}

/** Vasilhames que saem com a venda: um por unidade de cada produto que usa vasilhame. */
export function cartBottles(lines: CartLine[]): BottleLine[] {
  const byType = new Map<string, BottleLine>();
  for (const { item, quantity } of lines) {
    const bottle = item.product.bottleType;
    if (!bottle) continue;
    const current = byType.get(bottle.id);
    byType.set(bottle.id, {
      bottleTypeId: bottle.id,
      name: bottle.name,
      taken: (current?.taken ?? 0) + quantity,
    });
  }
  return [...byType.values()];
}
