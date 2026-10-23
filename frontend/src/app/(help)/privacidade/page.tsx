import type { Metadata } from "next";
import { LegalPage } from "@/components/app/legal-page";
import { privacySections } from "@/content/legal";

export const metadata: Metadata = { title: "Política de privacidade" };

// Monta na hora: os dados de quem opera o sistema vêm das variáveis LEGAL_* do ambiente.
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return <LegalPage title="Política de privacidade" sections={privacySections()} />;
}
