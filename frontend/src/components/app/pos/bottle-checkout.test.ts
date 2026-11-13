import { describe, expect, it } from "vitest";
import {
  bottleRows,
  bottlesNeedCustomer,
  bottlesTotal,
  type PricedBottleLine,
} from "./bottle-checkout";

const litrao: PricedBottleLine = { bottleTypeId: "lit", name: "Litrão", taken: 3, price: 8 };
const semPreco: PricedBottleLine = { bottleTypeId: "cx", name: "Caixa", taken: 2, price: null };

describe("vasilhames no fechamento da venda", () => {
  it("sem compra nem devolução: tudo vai emprestado", () => {
    const [row] = bottleRows([litrao], {}, {});
    expect(row).toMatchObject({ bought: 0, gave: 0, balance: 3 });
    expect(bottlesNeedCustomer([row])).toBe(true);
    expect(bottlesTotal([row])).toBe(0);
  });

  it("compra parte dos cascos, devolve vazio e empresta o resto", () => {
    const rows = bottleRows([litrao], { lit: 1 }, { lit: 1 });
    expect(rows[0]).toMatchObject({ bought: 1, gave: 1, balance: 1 });
    expect(bottlesTotal(rows)).toBe(8);
  });

  it("comprou todos os cascos: não precisa de cliente", () => {
    const rows = bottleRows([litrao], {}, { lit: 3 });
    expect(rows[0].balance).toBe(0);
    expect(bottlesNeedCustomer(rows)).toBe(false);
    expect(bottlesTotal(rows)).toBe(24);
  });

  it("não compra mais cascos do que saem nem casco sem preço", () => {
    const rows = bottleRows([litrao, semPreco], { cx: 2 }, { lit: 10, cx: 2 });
    expect(rows[0]).toMatchObject({ bought: 3, balance: 0 });
    expect(rows[1]).toMatchObject({ bought: 0, gave: 2, balance: 0 });
    expect(bottlesTotal(rows)).toBe(24);
  });

  it("devolver mais do que leva deixa crédito (exige cliente)", () => {
    const rows = bottleRows([litrao], { lit: 5 }, {});
    expect(rows[0].balance).toBe(-2);
    expect(bottlesNeedCustomer(rows)).toBe(true);
  });

  it("soma em centavos sem erro de ponto flutuante", () => {
    const rows = bottleRows(
      [{ bottleTypeId: "a", name: "A", taken: 3, price: 0.1 }],
      {},
      { a: 3 },
    );
    expect(bottlesTotal(rows)).toBe(0.3);
  });
});
