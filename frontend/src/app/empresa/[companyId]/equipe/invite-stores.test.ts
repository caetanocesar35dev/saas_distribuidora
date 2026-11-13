import { describe, expect, it } from "vitest";
import { allSelected, commonRole, selectAllStores, setRoleForAll } from "./invite-stores";

const stores = ["a", "b", "c"];

describe("convite: todas as lojas", () => {
  it("allSelected só quando todas estão marcadas", () => {
    expect(allSelected(stores, {})).toBe(false);
    expect(allSelected(stores, { a: "EMPLOYEE", b: "EMPLOYEE" })).toBe(false);
    expect(allSelected(stores, { a: "EMPLOYEE", b: "MANAGER", c: "EMPLOYEE" })).toBe(true);
    expect(allSelected([], {})).toBe(false);
  });

  it("marcar todas: sem nada marcado, entra como atendente", () => {
    expect(selectAllStores(stores, {})).toEqual({ a: "EMPLOYEE", b: "EMPLOYEE", c: "EMPLOYEE" });
  });

  it("marcar todas: mantém o papel já escolhido e usa o papel em comum nas novas", () => {
    expect(selectAllStores(stores, { b: "MANAGER" })).toEqual({
      a: "MANAGER",
      b: "MANAGER",
      c: "MANAGER",
    });
    expect(selectAllStores(stores, { a: "MANAGER", b: "EMPLOYEE" })).toEqual({
      a: "MANAGER",
      b: "EMPLOYEE",
      c: "EMPLOYEE",
    });
  });

  it("marcar todas ignora loja marcada que não está mais na lista", () => {
    expect(selectAllStores(["a"], { x: "MANAGER" })).toEqual({ a: "MANAGER" });
  });

  it("mesmo papel em todas as marcadas", () => {
    expect(setRoleForAll({ a: "EMPLOYEE", b: "MANAGER" }, "OWNER")).toEqual({
      a: "OWNER",
      b: "OWNER",
    });
    expect(setRoleForAll({}, "MANAGER")).toEqual({});
  });

  it("papel em comum", () => {
    expect(commonRole({})).toBeNull();
    expect(commonRole({ a: "MANAGER", b: "MANAGER" })).toBe("MANAGER");
    expect(commonRole({ a: "MANAGER", b: "EMPLOYEE" })).toBeNull();
  });
});
