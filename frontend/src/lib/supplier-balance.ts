import { formatInt } from "@/lib/format";

/** Saldo de cascos com o fornecedor (recebidos − enviados) em palavras. */
export function supplierBalanceText(balance: number): {
  text: string;
  tone: "owe" | "owed" | "even";
} {
  if (balance > 0) {
    return {
      text: `A loja deve ${formatInt(balance)} ${balance === 1 ? "casco" : "cascos"}`,
      tone: "owe",
    };
  }
  if (balance < 0) {
    const n = -balance;
    return {
      text: `O fornecedor deve ${formatInt(n)} ${n === 1 ? "casco" : "cascos"}`,
      tone: "owed",
    };
  }
  return { text: "Em dia", tone: "even" };
}
