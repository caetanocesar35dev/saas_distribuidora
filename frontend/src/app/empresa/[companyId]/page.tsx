import type { Metadata } from "next";
import { CompanyHome } from "./company-home";

export const metadata: Metadata = { title: "Painel da empresa" };

export default function CompanyHomePage() {
  return <CompanyHome />;
}
