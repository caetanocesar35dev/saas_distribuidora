import type { Metadata } from "next";
import { NewCompanyView } from "./new-company-view";

export const metadata: Metadata = { title: "Nova empresa" };

export default function NewCompanyPage() {
  return <NewCompanyView />;
}
