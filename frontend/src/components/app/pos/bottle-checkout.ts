import { roundMoney } from "@/lib/format";

/** Vasilhames que saem junto com a venda (1 por unidade de produto com vasilhame). */
export interface BottleLine {
  bottleTypeId: string;
  name: string;
  taken: number;
}

export interface PricedBottleLine extends BottleLine {
  /** Preço do casco (vale para a empresa toda). null = o casco não é vendido. */
  price: number | null;
}

/** O que acontece com os vasilhames de um tipo no fechamento da venda. */
export interface BottleRow extends PricedBottleLine {
  /** Cascos que o cliente compra (ficam dele, sem dívida). Nunca passa de `taken`. */
  bought: number;
  /** Vazios que o cliente devolve agora. */
  gave: number;
  /** Positivo: fica devendo; negativo: fica com crédito; 0: trocou tudo (ou comprou). */
  balance: number;
}

type Counts = Record<string, number | undefined>;

/**
 * Para cada tipo: dos `taken` vasilhames que saem, `bought` o cliente compra e o resto vai
 * emprestado; `gave` vazios ele devolve. Sem preço, o casco não é comprado.
 */
export function bottleRows(
  lines: PricedBottleLine[],
  returned: Counts,
  bought: Counts,
): BottleRow[] {
  return lines.map((line) => {
    const gave = returned[line.bottleTypeId] ?? 0;
    const buy = line.price === null ? 0 : Math.min(bought[line.bottleTypeId] ?? 0, line.taken);
    return { ...line, bought: buy, gave, balance: line.taken - buy - gave };
  });
}

/** Valor dos cascos comprados (entra no total da venda, sem desconto). */
export function bottlesTotal(rows: BottleRow[]): number {
  const cents = rows.reduce(
    (sum, row) => sum + (row.price === null ? 0 : Math.round(row.price * 100) * row.bought),
    0,
  );
  return roundMoney(cents / 100);
}

/** Quem sai devendo (ou com crédito) de vasilhame precisa ser identificado na venda. */
export function bottlesNeedCustomer(rows: BottleRow[]): boolean {
  return rows.some((row) => row.balance !== 0);
}
