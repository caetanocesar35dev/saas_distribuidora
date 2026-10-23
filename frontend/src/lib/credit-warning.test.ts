import { describe, expect, it } from "vitest";
import type { CustomerBalances } from "@/lib/api/types";
import { creditLimitCheck, creditWarning, debtSplit, salesLabel } from "./credit-warning";

const store = (
  storeId: string,
  balance: number,
  openCreditSales: number,
  oldestOpenCreditSaleAt: string | null = null,
) => ({ storeId, storeName: `Loja ${storeId}`, balance, openCreditSales, oldestOpenCreditSaleAt });

const balances = (
  perStore: CustomerBalances["perStore"],
  extra: Partial<CustomerBalances> = {},
): CustomerBalances => ({
  total: null,
  creditLimit: null,
  perStore,
  bottles: [],
  ...extra,
});

describe("creditWarning", () => {
  it("sem dívida (ou só crédito a favor) não avisa", () => {
    expect(creditWarning(balances([]), "A")).toBeNull();
    expect(creditWarning(balances([store("A", -5, 0)]), "A")).toBeNull();
  });

  it("soma valor e vendas das lojas, com a loja atual primeiro e a venda mais antiga", () => {
    const warning = creditWarning(
      balances([
        store("A", 10.1, 1, "2026-10-05T12:00:00.000Z"),
        store("B", 20.2, 3, "2026-10-01T12:00:00.000Z"),
        store("C", -3, 0),
      ]),
      "B",
    );
    expect(warning).toEqual({
      amount: 30.3,
      sales: 4,
      oldest: "2026-10-01T12:00:00.000Z",
      stores: [
        { storeId: "B", storeName: "Loja B", amount: 20.2, sales: 3 },
        { storeId: "A", storeName: "Loja A", amount: 10.1, sales: 1 },
      ],
    });
  });

  it("dívida sem venda registrada ainda avisa (sem contagem)", () => {
    expect(creditWarning(balances([store("A", 50, 0)]), "A")).toMatchObject({
      amount: 50,
      sales: 0,
      oldest: null,
    });
  });

  it("separa a dívida da lista em nesta loja e outras lojas", () => {
    expect(debtSplit([], "A")).toEqual({ here: 0, others: 0, total: 0 });
    expect(
      debtSplit(
        [
          { storeId: "A", balance: 10.1 },
          { storeId: "B", balance: 0.2 },
          { storeId: "C", balance: 0.1 },
          { storeId: "D", balance: -3 },
        ],
        "A",
      ),
    ).toEqual({ here: 10.1, others: 0.3, total: 10.4 });
  });

  it("limite de crédito: sem limite não confere; usa o total da empresa quando vem", () => {
    expect(creditLimitCheck(balances([store("A", 40, 2)]), 10)).toBeNull();

    // gerente/dono: total da empresa (inclui loja que não aparece em perStore)
    const asManager = balances([store("A", 40, 2)], { total: 45, creditLimit: 50 });
    expect(creditLimitCheck(asManager, 5)).toEqual({ limit: 50, debt: 45, after: 50, over: false });
    expect(creditLimitCheck(asManager, 5.01)).toMatchObject({ after: 50.01, over: true });

    // atendente: só as lojas que ele vê
    const asEmployee = balances([store("A", 40, 2), store("B", -2, 0)], { creditLimit: 50 });
    expect(creditLimitCheck(asEmployee, 20)).toEqual({ limit: 50, debt: 40, after: 60, over: true });
    // sem dívida, a venda sozinha pode passar do limite
    expect(creditLimitCheck(balances([], { total: 0, creditLimit: 0 }), 1)?.over).toBe(true);
  });

  it("escreve a quantidade de vendas", () => {
    expect(salesLabel(1)).toBe("1 venda");
    expect(salesLabel(3)).toBe("3 vendas");
  });
});
