import type { Metadata } from "next";
import { CustomersView } from "./customers-view";

export const metadata: Metadata = { title: "Clientes e fiado" };

export default function CustomersPage() {
  return <CustomersView />;
}
