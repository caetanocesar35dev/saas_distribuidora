import { roundMoney } from "@/lib/format";

/**
 * Preço e custo da embalagem (decisão do usuário): a embalagem pode ter preço próprio e, por padrão,
 * a unidade é o preço dela ÷ a quantidade; o vendedor pode pôr outro preço na unidade (o cigarro
 * picado costuma ser mais caro que o maço dividido). Sem preço da embalagem, ela vale unidade ×
 * quantidade. O custo é digitado por embalagem e guardado por unidade, com até 4 casas.
 */

/** Item de venda ou comanda: `quantity` é o total em unidades (já com as embalagens). */
export function itemTotal(item: {
  quantity: number;
  packs: number;
  packSize: number | null;
  price: number;
  packPrice: number | null;
}): number {
  const size = item.packSize ?? 0;
  const loose = item.quantity - item.packs * size;
  return roundMoney(loose * item.price + item.packs * (item.packPrice ?? item.price * size));
}

export function defaultUnitPrice(packPrice: number, packSize: number): number {
  return roundMoney(packPrice / packSize);
}

export function unitCostFromPack(packCost: number, packSize: number): number {
  return Math.round((packCost / packSize) * 10000) / 10000;
}

export function packCostFromUnit(unitCost: number, packSize: number): number {
  return roundMoney(unitCost * packSize);
}

/** O que está digitado no formulário. Vazio = usa o padrão. `cost` é o custo da embalagem. */
export interface PriceDraft {
  packPrice?: number;
  unitPrice?: number;
  cost?: number;
}

/** Converte o formulário no que a API recebe. `price` indefinido = falta informar o preço. */
export function resolvePrices(
  own: PriceDraft,
  packSize: number,
  fallback: PriceDraft = {},
): { price?: number; packPrice?: number; costPrice?: number } {
  const hasPack = packSize > 1;
  const packPrice = hasPack ? (own.packPrice ?? fallback.packPrice) : undefined;
  const price =
    own.unitPrice ??
    fallback.unitPrice ??
    (packPrice === undefined ? undefined : defaultUnitPrice(packPrice, packSize));
  const cost = own.cost ?? fallback.cost;
  return {
    price,
    packPrice,
    costPrice: cost === undefined ? undefined : hasPack ? unitCostFromPack(cost, packSize) : cost,
  };
}

/** Preenche o formulário com o que a loja já tem. A unidade igual ao padrão fica vazia (automática). */
export function draftFromOffer(
  offer: { price: number; packPrice: number | null; costPrice?: number },
  packSize: number,
): PriceDraft {
  if (packSize <= 1) return { unitPrice: offer.price, cost: offer.costPrice };
  const packPrice = offer.packPrice ?? undefined;
  const isDefault = packPrice !== undefined && defaultUnitPrice(packPrice, packSize) === offer.price;
  return {
    packPrice,
    unitPrice: isDefault ? undefined : offer.price,
    cost: offer.costPrice === undefined ? undefined : packCostFromUnit(offer.costPrice, packSize),
  };
}
