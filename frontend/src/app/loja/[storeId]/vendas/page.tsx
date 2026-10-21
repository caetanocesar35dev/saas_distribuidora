import type { Metadata } from "next";
import { SalesView } from "./sales-view";

export const metadata: Metadata = { title: "Vendas" };

export default function SalesPage() {
  return <SalesView />;
}
