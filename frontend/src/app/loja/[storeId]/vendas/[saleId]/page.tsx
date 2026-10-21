import type { Metadata } from "next";
import { SaleDetailView } from "./sale-detail-view";

export const metadata: Metadata = { title: "Detalhe da venda" };

export default async function SaleDetailPage({
  params,
}: PageProps<"/loja/[storeId]/vendas/[saleId]">) {
  const { saleId } = await params;
  return <SaleDetailView saleId={saleId} />;
}
