import type { Metadata } from "next";
import { CashDetailView } from "./cash-detail-view";

export const metadata: Metadata = { title: "Detalhe do caixa" };

export default async function CashDetailPage({
  params,
}: PageProps<"/loja/[storeId]/caixa/[cashId]">) {
  const { cashId } = await params;
  return <CashDetailView cashId={cashId} />;
}
