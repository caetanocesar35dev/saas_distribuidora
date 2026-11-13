import { describe, expect, it } from "vitest";
import { splitCashPayment } from "./pay-change";

const money = (toPay: number, tendered?: number, debt: number | null = 300, capAtDebt = true) =>
  splitCashPayment({ toPay, tendered, debt, method: "MONEY", capAtDebt });

describe("splitCashPayment", () => {
  it("nota maior que o valor a abater: troco da diferença", () => {
    // deve 300, entrega 200 e quer abater 180
    expect(money(180, 200)).toEqual({ amount: 180, change: 20, short: 0 });
  });

  it("sem informar a nota: entregou o valor exato, sem troco", () => {
    expect(money(180)).toEqual({ amount: 180, change: 0, short: 0 });
    expect(money(180, 180)).toEqual({ amount: 180, change: 0, short: 0 });
  });

  it("valor a abater acima da dívida (automático): quita a dívida e o resto é troco", () => {
    expect(money(100, undefined, 73.5)).toEqual({ amount: 73.5, change: 26.5, short: 0 });
    expect(money(100, 200, 73.5)).toEqual({ amount: 73.5, change: 126.5, short: 0 });
  });

  it("escolher por loja não limita pela dívida (a divisão é conferida à parte)", () => {
    expect(money(100, 150, 73.5, false)).toEqual({ amount: 100, change: 50, short: 0 });
  });

  it("nota menor que o valor a abater: falta receber", () => {
    expect(money(180, 150)).toEqual({ amount: 180, change: 0, short: 30 });
  });

  it("dívida total desconhecida: não limita pela dívida", () => {
    expect(money(100, 120, null)).toEqual({ amount: 100, change: 20, short: 0 });
  });

  it("sem troco em PIX e cartão", () => {
    const pix = splitCashPayment({ toPay: 100, tendered: 200, debt: 73.5, method: "PIX", capAtDebt: true });
    expect(pix).toEqual({ amount: 100, change: 0, short: 0 });
  });

  it("sem erro de ponto flutuante", () => {
    expect(money(30.1, 50)).toEqual({ amount: 30.1, change: 19.9, short: 0 });
  });
});
