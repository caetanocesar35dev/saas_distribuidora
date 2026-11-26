import { describe, expect, it } from "vitest";
import {
  filledOptions,
  pollFormError,
  pollPercent,
  sameSelection,
  toggleOption,
} from "./poll";

describe("enquete: voto", () => {
  it("escolha única troca a opção; múltipla marca e desmarca", () => {
    expect(toggleOption(["a"], "b", false)).toEqual(["b"]);
    expect(toggleOption(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleOption(["a", "b"], "a", true)).toEqual(["b"]);
  });

  it("a mesma escolha em outra ordem não conta como mudança", () => {
    expect(sameSelection(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameSelection(["a"], ["a", "b"])).toBe(false);
  });

  it("porcentagem sobre quem votou, escondida quando não há resultado", () => {
    expect(pollPercent(1, 3)).toBe(33);
    expect(pollPercent(0, 0)).toBe(0);
    expect(pollPercent(null, null)).toBeNull();
  });
});

describe("enquete: formulário da plataforma", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  const ok = {
    options: ["Nota fiscal", "Delivery", ""],
    endsAt: now + 86_400_000,
    publishedAt: null,
    expiresAt: null,
    now,
  };

  it("ignora as opções vazias", () => {
    expect(filledOptions([" A ", "", "  "])).toEqual(["A"]);
    expect(pollFormError(ok)).toBeNull();
  });

  it("aponta o que falta", () => {
    expect(pollFormError({ ...ok, options: ["Só uma", ""] })).toMatch(/pelo menos 2/);
    expect(pollFormError({ ...ok, options: ["Sim", "sim"] })).toMatch(/repetir/);
    expect(pollFormError({ ...ok, endsAt: null })).toMatch(/prazo/);
    expect(pollFormError({ ...ok, endsAt: now - 1 })).toMatch(/futuro/);
    expect(pollFormError({ ...ok, publishedAt: ok.endsAt + 1 })).toMatch(/publicação/);
    expect(pollFormError({ ...ok, expiresAt: ok.endsAt - 1 })).toMatch(/expirar/);
  });

  it("ao editar, o prazo pode ficar no passado (encerrar antes)", () => {
    expect(pollFormError({ ...ok, endsAt: now - 1, now: null })).toBeNull();
  });
});
