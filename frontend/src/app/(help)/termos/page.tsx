import type { Metadata } from "next";
import { LegalPage } from "@/components/app/legal-page";
import { termsSections } from "@/content/legal";

export const metadata: Metadata = { title: "Termos de uso" };

// Monta na hora: os dados de quem opera o sistema vêm das variáveis LEGAL_* do ambiente.
export const dynamic = "force-dynamic";

export default function TermsPage() {
  return <LegalPage title="Termos de uso" sections={termsSections()} />;
}
