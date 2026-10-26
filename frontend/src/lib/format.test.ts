import { describe, expect, it } from "vitest";
import {
  addDaysToDayString,
  dayEndIso,
  dayStartIso,
  daysUntil,
  formatCents,
  formatCnpj,
  formatDayString,
  cleanPersonName,
  formatAddress,
  formatItemQuantity,
  formatMoney,
  formatPhone,
  fromDatetimeLocal,
  hasMinRole,
  isValidCnpj,
  isValidPersonName,
  isValidPhone,
  maskCnpj,
  maskPhone,
  maskUf,
  normalizeCnpj,
  moneyToInput,
  parseMoney,
  roundMoney,
  safeNextPath,
  todayString,
  toDatetimeLocal,
} from "./format";

/** O Intl usa espaço sem quebra entre "R$" e o número. */
const plain = (text: string) => text.replace(/ /g, " ");

describe("dinheiro", () => {
  it("formata em reais com 2 casas", () => {
    expect(plain(formatMoney(1234.5))).toBe("R$ 1.234,50");
    expect(plain(formatMoney(0))).toBe("R$ 0,00");
    expect(plain(formatMoney(null))).toBe("R$ 0,00");
    expect(plain(formatCents(9900))).toBe("R$ 99,00");
  });

  it("lê o que a pessoa digita (vírgula, ponto, milhar, R$)", () => {
    expect(parseMoney("12,5")).toBe(12.5);
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("10.50")).toBe(10.5);
    expect(parseMoney("R$ 5")).toBe(5);
    expect(parseMoney("1.234")).toBe(1234);
    expect(parseMoney("1.234.567")).toBe(1234567);
    expect(parseMoney("0,005")).toBe(0.01);
  });

  it("recusa texto que não é dinheiro", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1,2,3")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
  });

  it("devolve o valor para o campo com vírgula", () => {
    expect(moneyToInput(12.5)).toBe("12,50");
    expect(moneyToInput(undefined)).toBe("");
  });

  it("arredonda para centavos sem erro de ponto flutuante", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.5 * 3)).toBe(7.5);
  });
});

describe("telefone e UF da loja", () => {
  it("máscara de telefone fixo e celular enquanto digita", () => {
    expect(maskPhone("8")).toBe("(8");
    expect(maskPhone("8133")).toBe("(81) 33");
    expect(maskPhone("8133334444")).toBe("(81) 3333-4444");
    expect(maskPhone("81999990000")).toBe("(81) 99999-0000");
    expect(maskPhone("(81) 99999-0000 ramal 2")).toBe("(81) 99999-0000");
  });

  it("valida fixo (10 dígitos) e celular (11, com 9 depois do DDD)", () => {
    expect(isValidPhone("(81) 3333-4444")).toBe(true);
    expect(isValidPhone("81999990000")).toBe(true);
    expect(isValidPhone("(81) 3333-444")).toBe(false);
    expect(isValidPhone("81899990000")).toBe(false);
    expect(isValidPhone("01999990000")).toBe(false);
  });

  it("UF: só 2 letras, maiúsculas", () => {
    expect(maskUf("pe")).toBe("PE");
    expect(maskUf("p3e9x")).toBe("PE");
  });
});

describe("nome de pessoa", () => {
  it("aceita letras, acentos, apóstrofo, hífen e ponto; recusa números e símbolos", () => {
    for (const ok of ["Maria", "João D'Ávila-Neto", "Ana Maria Jr.", "Zoë Müller", " Maria "]) {
      expect(isValidPersonName(ok), ok).toBe(true);
    }
    for (const bad of ["", "   ", "Maria 2", "123", "Maria@Silva", "-Maria", "Maria_"]) {
      expect(isValidPersonName(bad), bad).toBe(false);
    }
  });

  it("limpa números e símbolos do que foi digitado ou colado", () => {
    expect(cleanPersonName("Maria 123 Silva")).toBe("Maria  Silva");
    expect(cleanPersonName("João D'Ávila-Neto Jr.")).toBe("João D'Ávila-Neto Jr.");
    expect(cleanPersonName("a1b2@c#")).toBe("abc");
  });
});

describe("endereço em uma linha", () => {
  it("pula campos vazios", () => {
    expect(formatAddress({})).toBe("");
    expect(
      formatAddress({
        street: "Rua A",
        number: "10",
        complement: "Sala 3",
        neighborhood: "Centro",
        city: "Recife",
        state: "PE",
        zipCode: "50030-230",
      }),
    ).toBe("Rua A, 10 - Sala 3 · Centro · Recife/PE · CEP 50030-230");
    expect(formatAddress({ street: "Rua B", city: "Olinda" })).toBe("Rua B · Olinda");
    expect(formatAddress({ zipCode: "50030-230", state: "PE" })).toBe("PE · CEP 50030-230");
  });
});

describe("quantidade do item (venda em lote)", () => {
  it("mostra fardos e unidades avulsas", () => {
    expect(formatItemQuantity(5, 0, null)).toBe("5 un.");
    expect(formatItemQuantity(24, 2, 12)).toBe("2 fardos de 12");
    expect(formatItemQuantity(15, 1, 12)).toBe("1 fardo de 12 + 3 un.");
    expect(formatItemQuantity(1200, 0, undefined)).toBe("1.200 un.");
  });
});

describe("CNPJ, telefone e papéis", () => {
  it("confere os dígitos verificadores", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
  });

  it("aceita CNPJ alfanumérico (exemplo oficial da Receita)", () => {
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12abc34501de35")).toBe(true);
    expect(isValidCnpj("12ABC34501DE36")).toBe(false);
    expect(isValidCnpj("12ABC34501DEAB")).toBe(false);
    expect(isValidCnpj("AAAAAAAAAAAAAA")).toBe(false);
    expect(normalizeCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });

  it("aplica a máscara enquanto digita", () => {
    expect(maskCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskCnpj("11.222")).toBe("11.222");
    expect(maskCnpj("11.2")).toBe("11.2");
    expect(maskCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(maskCnpj("11.222.333/0001-81-99 @")).toBe("11.222.333/0001-81");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });

  it("formata telefone de 10 e 11 dígitos", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhone(null)).toBe("");
  });

  it("OWNER > MANAGER > EMPLOYEE", () => {
    expect(hasMinRole("OWNER", "MANAGER")).toBe(true);
    expect(hasMinRole("MANAGER", "MANAGER")).toBe(true);
    expect(hasMinRole("EMPLOYEE", "MANAGER")).toBe(false);
    expect(hasMinRole(null, "EMPLOYEE")).toBe(false);
  });
});

describe("redirecionamento seguro", () => {
  it("só aceita caminhos internos", () => {
    expect(safeNextPath("/loja/abc/pdv")).toBe("/loja/abc/pdv");
    expect(safeNextPath("https://site-malicioso.com")).toBeNull();
    expect(safeNextPath("//site-malicioso.com")).toBeNull();
    expect(safeNextPath("/\\site-malicioso.com")).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

describe("datas no fuso de São Paulo", () => {
  it("dia de hoje respeita o fuso (3h da manhã UTC ainda é o dia anterior em SP)", () => {
    expect(todayString(new Date("2026-10-16T02:00:00Z"))).toBe("2026-10-15");
    expect(todayString(new Date("2026-10-16T12:00:00Z"))).toBe("2026-10-16");
  });

  it("início e fim do dia em ISO", () => {
    expect(dayStartIso("2026-10-16")).toBe("2026-10-16T03:00:00.000Z");
    expect(dayEndIso("2026-10-16")).toBe("2026-10-17T02:59:59.999Z");
  });

  it("soma dias e formata dia do calendário", () => {
    expect(addDaysToDayString("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDayString("2026-03-01", -1)).toBe("2026-02-28");
    expect(formatDayString("2026-10-16")).toBe("16/10/2026");
  });

  it("conta quantos dias faltam", () => {
    const now = new Date("2026-10-16T12:00:00Z");
    expect(daysUntil("2026-10-19T12:00:00Z", now)).toBe(3);
    expect(daysUntil("2026-10-16T13:00:00Z", now)).toBe(1);
    expect(daysUntil("2026-10-10T12:00:00Z", now)).toBe(0);
  });

  it("ida e volta do campo datetime-local", () => {
    const iso = "2026-10-16T15:30:00.000Z";
    expect(new Date(fromDatetimeLocal(toDatetimeLocal(iso)) ?? "").toISOString()).toBe(iso);
    expect(fromDatetimeLocal("")).toBeUndefined();
    expect(toDatetimeLocal(null)).toBe("");
  });
});
