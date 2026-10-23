import type { StoreProduct } from "@/lib/api/types";
import type { BottleLine } from "@/components/app/pos/checkout-dialog";
import { roundMoney } from "@/lib/format";

/**
 * Linha do carrinho. Venda em lote: `quantity` são as unidades avulsas e `packs` os fardos; o
 * total em unidades é `quantity + packs × packQuantity` (é o que conta para preço, estoque e
 * vasilhames). Uma linha sempre tem pelo menos uma unidade no total.
 */
export interface CartLine {
  item: StoreProduct;
  quantity: number;
  packs?: number;
}

export type CartAction =
  | { type: "add"; item: StoreProduct }
  | { type: "addPack"; item: StoreProduct }
  | { type: "set"; id: string; quantity: number }
  | { type: "setPacks"; id: string; packs: number }
  | { type: "remove"; id: string }
  | { type: "clear" };

/** Unidades por fardo do produto (1 = não vende em fardo). */
export const packSizeOf = (item: StoreProduct) => Math.max(item.product.packQuantity, 1);

/** Total da linha em unidades. */
export function lineUnits(line: CartLine): number {
  return line.quantity + (line.packs ?? 0) * packSizeOf(line.item);
}

/** Garante pelo menos uma unidade no total (sem fardos, a unidade mínima é 1). */
function normalize(line: CartLine): CartLine {
  const packs = Math.max(0, line.packs ?? 0);
  const quantity = Math.max(packs > 0 ? 0 : 1, line.quantity);
  return { ...line, packs, quantity };
}

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add":
    case "addPack": {
      const unit = action.type === "add" ? 1 : 0;
      const pack = action.type === "addPack" ? 1 : 0;
      const existing = state.find((l) => l.item.id === action.item.id);
      if (existing) {
        return state.map((l) =>
          l.item.id === action.item.id
            ? { ...l, item: action.item, quantity: l.quantity + unit, packs: (l.packs ?? 0) + pack }
            : l,
        );
      }
      return [...state, { item: action.item, quantity: unit, packs: pack }];
    }
    case "set":
      return state.map((l) =>
        l.item.id === action.id ? normalize({ ...l, quantity: action.quantity }) : l,
      );
    case "setPacks":
      return state.map((l) =>
        l.item.id === action.id ? normalize({ ...l, packs: action.packs }) : l,
      );
    case "remove":
      return state.filter((l) => l.item.id !== action.id);
    case "clear":
      return [];
  }
}

/** Prévia do subtotal (o valor oficial é o que o backend devolve ao concluir a venda). */
export function cartSubtotal(lines: CartLine[]): number {
  return roundMoney(lines.reduce((sum, l) => sum + roundMoney(l.item.price * lineUnits(l)), 0));
}

/** Vasilhames que saem com a venda: um por unidade de cada produto que usa vasilhame. */
export function cartBottles(lines: CartLine[]): BottleLine[] {
  const byType = new Map<string, BottleLine>();
  for (const line of lines) {
    const bottle = line.item.product.bottleType;
    if (!bottle) continue;
    const current = byType.get(bottle.id);
    byType.set(bottle.id, {
      bottleTypeId: bottle.id,
      name: bottle.name,
      taken: (current?.taken ?? 0) + lineUnits(line),
    });
  }
  return [...byType.values()];
}
