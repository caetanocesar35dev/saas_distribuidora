import { roundMoney } from "@/lib/format";
import type { PaymentMethod } from "@/lib/api/types";

/**
 * Troco no recebimento de fiado em dinheiro (decisão do usuário, 2026-11-13). O que vai para a API
 * (e entra no caixa) é só o valor abatido; o troco sai da gaveta na hora.
 *
 * - `toPay`: o que a pessoa quer abater. Acima da dívida (só com `capAtDebt`, o modo automático,
 *   e a dívida total conhecida), abate a dívida inteira e o resto vira troco.
 * - `tendered`: a nota que o cliente entregou (opcional). Ex.: deve 300, entrega 200 e quer abater
 *   180: troco de 20. Vazio = entregou exatamente o valor digitado em `toPay`.
 * - `short` > 0: a nota entregue não cobre o que vai ser abatido (não dá para receber assim).
 *
 * Em PIX e cartão não há troco: `amount` é o valor digitado.
 */
export function splitCashPayment(opts: {
  toPay: number;
  tendered?: number;
  debt: number | null;
  method: Exclude<PaymentMethod, "CREDIT_STORE">;
  capAtDebt: boolean;
}): { amount: number; change: number; short: number } {
  const { toPay, tendered, debt, method, capAtDebt } = opts;
  if (method !== "MONEY") return { amount: roundMoney(toPay), change: 0, short: 0 };

  const amount =
    capAtDebt && debt !== null && debt > 0 && toPay > debt ? roundMoney(debt) : roundMoney(toPay);
  const diff = roundMoney((tendered ?? toPay) - amount);
  return diff >= 0 ? { amount, change: diff, short: 0 } : { amount, change: 0, short: -diff };
}
