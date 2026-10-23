import { describe, expect, it } from "vitest";
import type { SubscriptionAccess } from "@/lib/api/types";
import { subscriptionNotice } from "./subscription";

const NOW = new Date("2026-10-16T12:00:00Z");

function sub(partial: Partial<SubscriptionAccess>): SubscriptionAccess {
  return {
    status: "ACTIVE",
    accessMode: "FULL",
    reason: null,
    trialEndsAt: null,
    pastDueSince: null,
    graceEndsAt: null,
    ...partial,
  };
}

describe("faixa de aviso da assinatura", () => {
  it("assinatura ativa não mostra nada", () => {
    expect(subscriptionNotice(sub({}), NOW)).toBeNull();
  });

  it("teste com muitos dias: aviso informativo", () => {
    const notice = subscriptionNotice(
      sub({ status: "TRIAL", trialEndsAt: "2026-10-30T12:00:00Z" }),
      NOW,
    );
    expect(notice?.tone).toBe("info");
    expect(notice?.description).toContain("14 dias");
  });

  it("nos últimos 3 dias do teste o aviso fica em destaque", () => {
    const notice = subscriptionNotice(
      sub({ status: "TRIAL", trialEndsAt: "2026-10-18T12:00:00Z" }),
      NOW,
    );
    expect(notice?.tone).toBe("warning");
    expect(notice?.description).toContain("2 dias");
  });

  it("carência: avisa a data em que vira somente leitura", () => {
    const notice = subscriptionNotice(
      sub({
        status: "PAST_DUE",
        accessMode: "GRACE",
        pastDueSince: "2026-10-14T12:00:00Z",
        graceEndsAt: "2026-10-19T12:00:00Z",
      }),
      NOW,
    );
    expect(notice?.tone).toBe("warning");
    expect(notice?.description).toContain("19/10/2026");
  });

  it("somente leitura: faixa de erro com o motivo e o que continua liberado", () => {
    const notice = subscriptionNotice(
      sub({ status: "CANCELED", accessMode: "READ_ONLY", reason: "CANCELED" }),
      NOW,
    );
    expect(notice?.tone).toBe("danger");
    expect(notice?.description).toContain("cancelada");
    expect(notice?.description).toContain("fechar o caixa");
  });
});
