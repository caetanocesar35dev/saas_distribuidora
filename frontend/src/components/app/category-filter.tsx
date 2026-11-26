"use client";

import { SelectField } from "@/components/app/inputs";
import { useProductCategories } from "@/lib/api/hooks/catalog";

const ALL = "all";
/** O mesmo valor que o backend aceita em `categoryId` para os produtos sem categoria. */
export const NO_CATEGORY = "none";

/** Filtro de categoria das listas de produtos. `value` undefined = todas as categorias. */
export function CategoryFilter({
  companyId,
  value,
  onChange,
  className,
}: {
  companyId: string;
  value: string | undefined;
  onChange: (categoryId: string | undefined) => void;
  className?: string;
}) {
  const categories = useProductCategories(companyId);
  return (
    <SelectField
      className={className}
      aria-label="Filtrar por categoria"
      value={value ?? ALL}
      onChange={(v) => onChange(v === ALL ? undefined : v)}
      options={[
        { value: ALL, label: "Todas as categorias" },
        { value: NO_CATEGORY, label: "Sem categoria" },
        ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
      ]}
    />
  );
}

/** Opções do campo Categoria nos formulários de produto. */
export function useCategoryOptions(companyId: string) {
  const categories = useProductCategories(companyId);
  return [
    { value: NO_CATEGORY, label: "Sem categoria" },
    ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];
}
