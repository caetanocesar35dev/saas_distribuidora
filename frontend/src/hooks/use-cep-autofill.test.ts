import { describe, expect, it } from "vitest";
import { canAutofill } from "./use-cep-autofill";

describe("canAutofill", () => {
  it("preenche campo vazio", () => {
    expect(canAutofill("", undefined, "Rua A")).toBe(true);
    expect(canAutofill(undefined, undefined, "Rua A")).toBe(true);
  });

  it("não troca o que a pessoa digitou", () => {
    expect(canAutofill("Rua digitada", undefined, "Rua A")).toBe(false);
    expect(canAutofill("Rua digitada", "Rua A", "Rua B")).toBe(false);
  });

  it("troca o que a consulta anterior preencheu", () => {
    expect(canAutofill("Rua A", "Rua A", "Rua B")).toBe(true);
  });

  it("na edição, troca o endereço salvo quando o CEP muda", () => {
    // `lastFilled` começa com o valor salvo (opção `initial` do hook)
    expect(canAutofill("Rua Salva", "Rua Salva", "Rua Nova")).toBe(true);
    // CEP geral de cidade, sem rua: limpa a rua antiga para a pessoa preencher
    expect(canAutofill("Rua Salva", "Rua Salva", "")).toBe(true);
  });

  it("não regrava o mesmo valor", () => {
    expect(canAutofill("Rua A", "Rua A", "Rua A")).toBe(false);
    expect(canAutofill("", undefined, "")).toBe(false);
  });
});
