import type { SaleChannelRef } from "@/lib/api/types";

/**
 * Origem da venda (decidido pelo usuário, 2026-11-22): balcão, WhatsApp, iFood, Zé Delivery...
 * Toda venda nova tem uma; as de antes de existir a origem aparecem como "Sem origem".
 */
export const NO_CHANNEL = "none";
export const NO_CHANNEL_LABEL = "Sem origem";

/** A que o PDV já deixa marcada: a padrão da empresa (ou a primeira, se nenhuma for padrão). */
export function defaultChannelId(
  channels: { id: string; isDefault: boolean }[] | undefined,
): string | undefined {
  if (!channels || channels.length === 0) return undefined;
  return (channels.find((c) => c.isDefault) ?? channels[0]).id;
}

/** A escolhida, se ainda existir na lista; senão, a padrão. */
export function effectiveChannelId(
  picked: string | undefined,
  channels: { id: string; isDefault: boolean }[] | undefined,
): string | undefined {
  if (picked && channels?.some((c) => c.id === picked)) return picked;
  return defaultChannelId(channels);
}

export function channelLabel(channel: SaleChannelRef | null | undefined): string {
  return channel?.name ?? NO_CHANNEL_LABEL;
}

/** Participação de cada origem no faturamento do mês, em % inteiro (0 sem faturamento). */
export function channelShare(revenue: number, totalRevenue: number): number {
  if (totalRevenue <= 0) return 0;
  return Math.round((revenue / totalRevenue) * 100);
}

/** Ticket médio (faturamento ÷ vendas), em reais com centavos. */
export function averageTicket(revenue: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round((revenue / count) * 100) / 100;
}
