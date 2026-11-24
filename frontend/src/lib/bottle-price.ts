/**
 * Preço do casco por loja (decidido pelo usuário, 2026-11-24): a empresa tem um preço (Vasilhames ›
 * Tipos) e a loja pode ter o próprio. Vale o da loja e, sem ele, o da empresa.
 */
export type CascoPriceSource = "store" | "company" | "none";

export function cascoPriceSource(line: {
  storePrice: number | null;
  companyPrice: number | null;
}): CascoPriceSource {
  if (line.storePrice !== null) return "store";
  if (line.companyPrice !== null) return "company";
  return "none";
}

export const CASCO_SOURCE_LABEL: Record<CascoPriceSource, string> = {
  store: "preço desta loja",
  company: "preço da empresa",
  none: "não é vendido",
};
