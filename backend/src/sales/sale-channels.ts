import { Prisma } from '@prisma/client';
import type { PrismaTx } from '../prisma/prisma.extension';

/**
 * Origem da venda (decidido pelo usuário, 2026-11-22). Lista com que toda empresa começa; ela pode
 * renomear, excluir e criar outras. A primeira é a padrão (já vem marcada no PDV).
 */
export const DEFAULT_SALE_CHANNELS = [
  'Balcão',
  'WhatsApp/Telefone',
  'iFood',
  'Zé Delivery',
  'Anota AI',
];

/** Valor do filtro `channelId` para as vendas sem origem (feitas antes de existir a origem). */
export const NO_CHANNEL = 'none';

export function createDefaultSaleChannels(tx: PrismaTx, companyId: string) {
  return tx.saleChannel.createMany({
    data: DEFAULT_SALE_CHANNELS.map((name, index) => ({
      companyId,
      name,
      isDefault: index === 0,
    })),
  });
}

/** Filtro de venda por origem (`channelId` da listagem). */
export function channelWhere(channelId?: string): Prisma.SaleWhereInput {
  if (!channelId) return {};
  return { channelId: channelId === NO_CHANNEL ? null : channelId };
}
