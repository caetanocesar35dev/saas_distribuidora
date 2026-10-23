import type { Metadata } from "next";
import { CustomerDetailView } from "./customer-detail-view";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerDetailPage({
  params,
}: PageProps<"/loja/[storeId]/clientes/[customerId]">) {
  const { customerId } = await params;
  return <CustomerDetailView customerId={customerId} />;
}
