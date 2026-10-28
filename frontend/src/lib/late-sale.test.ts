import { describe, expect, it } from "vitest";
import { lateSaleDateError } from "./late-sale";

describe("data da venda antiga", () => {
  const now = new Date("2026-10-23T15:00:00");

  it("exige a data e recusa data inválida ou no futuro", () => {
    expect(lateSaleDateError("", now)).toBe("Informe a data e a hora em que a venda aconteceu.");
    expect(lateSaleDateError("lixo", now)).toBe("Data inválida.");
    expect(lateSaleDateError("2026-10-23T15:01", now)).toBe(
      "A data da venda não pode ser no futuro.",
    );
  });

  it("aceita agora e qualquer data passada, sem limite", () => {
    expect(lateSaleDateError("2026-10-23T15:00", now)).toBeNull();
    expect(lateSaleDateError("2026-10-22T09:30", now)).toBeNull();
    expect(lateSaleDateError("2019-01-01T08:00", now)).toBeNull();
  });
});
