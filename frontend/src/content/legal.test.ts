import { afterEach, describe, expect, it, vi } from "vitest";
import { legalOperator, privacySections, termsSections } from "./legal";

describe("dados de quem opera o sistema (variáveis LEGAL_*)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sem variável, o campo aparece entre colchetes", () => {
    vi.stubEnv("LEGAL_OPERATOR_NAME", "");
    vi.stubEnv("LEGAL_OPERATOR_CNPJ", "");
    vi.stubEnv("LEGAL_CONTACT_EMAIL", "  ");
    vi.stubEnv("LEGAL_FORUM", "");
    expect(legalOperator()).toEqual({
      name: "[NOME DA EMPRESA RESPONSÁVEL PELO SISTEMA]",
      cnpj: "[CNPJ]",
      email: "[E-MAIL DE CONTATO E DO ENCARREGADO DE DADOS]",
      forum: "[CIDADE/UF]",
    });
  });

  it("usa os valores do ambiente nos textos, com o CNPJ formatado", () => {
    vi.stubEnv("LEGAL_OPERATOR_NAME", "Sistema Bebidas LTDA");
    vi.stubEnv("LEGAL_OPERATOR_CNPJ", "12abc34501de35");
    vi.stubEnv("LEGAL_CONTACT_EMAIL", "dpo@exemplo.com");
    vi.stubEnv("LEGAL_FORUM", "Recife/PE");
    expect(legalOperator().cnpj).toBe("12.ABC.345/01DE-35");

    const terms = termsSections().flatMap((s) => s.paragraphs).join(" ");
    expect(terms).toContain("Sistema Bebidas LTDA (CNPJ 12.ABC.345/01DE-35)");
    expect(terms).toContain("foro da comarca de Recife/PE");
    expect(terms).not.toContain("[");
    const privacy = privacySections().flatMap((s) => s.paragraphs).join(" ");
    expect(privacy).toContain("dpo@exemplo.com");
    expect(privacy).not.toContain("[");
  });
});
