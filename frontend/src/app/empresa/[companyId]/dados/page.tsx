import type { Metadata } from "next";
import { CompanyDataView } from "./company-data-view";

export const metadata: Metadata = { title: "Dados da empresa" };

export default function CompanyDataPage() {
  return <CompanyDataView />;
}
