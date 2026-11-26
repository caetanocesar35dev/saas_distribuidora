import { Prisma } from '@prisma/client';
import type { PrismaTx } from '../prisma/prisma.extension';

/** Lista sugerida com que toda empresa começa; ela pode renomear, excluir e criar outras. */
export const DEFAULT_PRODUCT_CATEGORIES = [
  'Bebidas',
  'Cigarros',
  'Salgadinhos',
  'Mercearia',
  'Gelo e carvão',
];

/** Valor do filtro `categoryId` para os produtos sem categoria. */
export const NO_CATEGORY = 'none';

export function createDefaultCategories(tx: PrismaTx, companyId: string) {
  return tx.productCategory.createMany({
    data: DEFAULT_PRODUCT_CATEGORIES.map((name) => ({ companyId, name })),
  });
}

/** Filtro de produto por categoria (`categoryId` da listagem). */
export function categoryWhere(categoryId?: string): Prisma.ProductWhereInput {
  if (!categoryId) return {};
  return { categoryId: categoryId === NO_CATEGORY ? null : categoryId };
}
