import type { Metadata } from "next";
import { TabDetailView } from "./tab-detail-view";

export const metadata: Metadata = { title: "Comanda" };

export default async function TabDetailPage({
  params,
}: PageProps<"/loja/[storeId]/comandas/[tabId]">) {
  const { tabId } = await params;
  return <TabDetailView tabId={tabId} />;
}
