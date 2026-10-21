import { describe, expect, it } from "vitest";
import type { CustomerBalances } from "@/lib/api/types";
import { creditWarning, debtSplit, salesLabel } from "./credit-warning";

const store = (
  storeId: string,
  balance: number,
  openCreditSales: number,
  oldestOpenCreditSaleAt: string | null = null,
) => ({ storeId, storeName: `Loja ${storeId}`, balance, openCreditSales, oldestOpenCreditSaleAt });

const balances = (perStore: CustomerBalances["perStore"]): CustomerBalances => ({
  total: null,
  perStore,
  bottles: [],
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

  it("escreve a quantidade de vendas", () => {
    expect(salesLabel(1)).toBe("1 venda");
    expect(salesLabel(3)).toBe("3 vendas");
  });
});
