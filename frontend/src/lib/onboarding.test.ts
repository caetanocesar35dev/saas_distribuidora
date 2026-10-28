import { describe, expect, it } from "vitest";
import { onboardingSteps } from "./onboarding";

describe("primeiros passos", () => {
  const ids = { storeId: "s1", companyId: "c1" };

  it("lista os quatro passos, na ordem, com o link de cada um", () => {
    const steps = onboardingSteps(
      { address: false, products: false, cashOpened: false, team: false },
      ids,
    );
    expect(steps.map((s) => [s.key, s.href])).toEqual([
      ["address", "/empresa/c1/lojas"],
      ["products", "/loja/s1/produtos/novo"],
      ["cashOpened", "/loja/s1/caixa"],
      ["team", "/empresa/c1/equipe"],
    ]);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("marca o que já foi feito", () => {
    const steps = onboardingSteps(
      { address: true, products: false, cashOpened: true, team: false },
      ids,
    );
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(["address", "cashOpened"]);
  });
});
