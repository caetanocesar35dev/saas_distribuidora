import { describe, expect, it } from "vitest";
import {
  discountText,
  normalizeReferralCode,
  referralLink,
  referralMessage,
  whatsappShareUrl,
} from "./referral";

describe("indicação", () => {
  it("normaliza o código como o backend", () => {
    expect(normalizeReferralCode(" joão-rep ")).toBe("JOAO-REP");
    expect(normalizeReferralCode("distri 7k2")).toBe("DISTRI7K2");
  });

  it("monta o link de cadastro com o código", () => {
    expect(referralLink("https://app.com/", "DISTRI-7K2")).toBe(
      "https://app.com/cadastro?ref=DISTRI-7K2",
    );
  });

  it("monta a mensagem e o link do WhatsApp", () => {
    const message = referralMessage("https://app.com/cadastro?ref=A-1", "A-1", {
      discountPercent: 20,
      discountMonths: 2,
      maxMonths: 12,
    });
    expect(message).toContain("20% de desconto nos 2 primeiros meses");
    expect(message).toContain("https://app.com/cadastro?ref=A-1");
    expect(whatsappShareUrl("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });

  it("descreve os meses de desconto", () => {
    expect(discountText(0, 20)).toBeNull();
    expect(discountText(1, 20)).toBe("1 mês com 20% de desconto");
    expect(discountText(4, 20)).toBe("4 meses com 20% de desconto");
  });
});
