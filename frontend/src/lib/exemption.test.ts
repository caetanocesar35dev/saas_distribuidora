import { describe, expect, it } from "vitest";
import { dayEndIso } from "@/lib/format";
import { exemptionChanges, exemptionLabel } from "./exemption";

const TODAY = "2026-11-22";
const notExempt = { wasExempt: false, exemptUntil: null, exemptReason: null };

describe("conta isenta: formulário da plataforma", () => {
  it("vitalícia: manda data limite nula e o motivo", () => {
    expect(
      exemptionChanges({ lifetime: true, until: "", reason: " Parceiro " }, notExempt, TODAY),
    ).toEqual({ body: { exemptUntil: null, exemptReason: "Parceiro" }, error: null });
  });

  it("com data: manda o fim daquele dia; sem motivo, não manda motivo", () => {
    expect(
      exemptionChanges({ lifetime: false, until: "2027-11-22", reason: "" }, notExempt, TODAY),
    ).toEqual({ body: { exemptUntil: dayEndIso("2027-11-22") }, error: null });
  });

  it("sem data e sem vitalícia, ou com data que já passou: não salva", () => {
    expect(
      exemptionChanges({ lifetime: false, until: "", reason: "" }, notExempt, TODAY).error,
    ).toMatch(/marque Vitalícia/);
    expect(
      exemptionChanges({ lifetime: false, until: TODAY, reason: "" }, notExempt, TODAY).error,
    ).toMatch(/depois de hoje/);
  });

  it("já isenta: só manda o que mudou", () => {
    const current = {
      wasExempt: true,
      exemptUntil: dayEndIso("2027-01-31"),
      exemptReason: "Parceiro",
    };
    expect(
      exemptionChanges({ lifetime: false, until: "2027-01-31", reason: "Parceiro" }, current, TODAY)
        .body,
    ).toEqual({});
    expect(
      exemptionChanges({ lifetime: true, until: "2027-01-31", reason: "Parceiro" }, current, TODAY)
        .body,
    ).toEqual({ exemptUntil: null });
    expect(
      exemptionChanges({ lifetime: false, until: "2027-01-31", reason: "" }, current, TODAY).body,
    ).toEqual({ exemptReason: null });
  });

  it("rótulo", () => {
    expect(exemptionLabel(null)).toBe("Isenta (vitalícia)");
    expect(exemptionLabel(dayEndIso("2027-01-31"))).toBe("Isenta até 31/01/2027");
  });
});
