import { describe, expect, it } from "vitest";
import { fieldLabel, formatAuditValue, isHiddenField } from "./audit-labels";

describe("histórico de alterações", () => {
  it("traduz nomes de campos e deixa os desconhecidos como estão", () => {
    expect(fieldLabel("costPrice")).toBe("Custo");
    expect(fieldLabel("campoNovo")).toBe("campoNovo");
  });

  it("esconde campos que mudam sozinhos", () => {
    expect(isHiddenField("updatedAt")).toBe(true);
    expect(isHiddenField("deletedAt")).toBe(true);
    expect(isHiddenField("price")).toBe(false);
  });

  it("traduz listas fixas do sistema", () => {
    expect(formatAuditValue("status", "CANCELED")).toBe("Cancelada");
    expect(formatAuditValue("paymentMethod", "CREDIT_STORE")).toBe("Fiado");
    expect(formatAuditValue("role", "MANAGER")).toBe("Gerente");
    expect(formatAuditValue("type", "SUPPLIER_SEND")).toBe("Envio ao fornecedor");
    expect(formatAuditValue("type", "OUT")).toBe("Saída");
  });

  it("formata dinheiro, sim/não, vazio e datas", () => {
    expect(formatAuditValue("price", 12.5).replace(/ /g, " ")).toBe("R$ 12,50");
    expect(formatAuditValue("stock", 12)).toBe("12");
    expect(formatAuditValue("isActive", true)).toBe("Sim");
    expect(formatAuditValue("isActive", false)).toBe("Não");
    expect(formatAuditValue("phone", null)).toBe("vazio");
    expect(formatAuditValue("name", "")).toBe("vazio");
    expect(formatAuditValue("openedAt", "2026-10-16T15:30:00.000Z")).toBe("16/10/2026, 12:30");
  });
});
