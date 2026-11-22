import type { Metadata } from "next";
import type { Plan } from "@/lib/api/types";
import { choosablePlans } from "@/lib/plans";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { API_URL } from "@/lib/server/config";
import { LandingPage } from "./landing-page";

const TITLE = `${SITE_NAME}: sistema para distribuidora de bebidas`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "pt_BR",
  },
};

// Os preços vêm do banco; a página fica pronta e é refeita a cada 5 minutos.
export const revalidate = 300;

/** Com o backend fora do ar, a página abre mesmo assim, sem a tabela de preços. */
async function loadPlans(): Promise<Plan[]> {
  try {
    const res = await fetch(`${API_URL}/plans`, { next: { revalidate } });
    if (!res.ok) return [];
    return choosablePlans((await res.json()) as Plan[]);
  } catch {
    return [];
  }
}

// Quem já está logado nem chega aqui: o proxy manda para a seleção de loja.
export default async function Home() {
  return <LandingPage plans={await loadPlans()} />;
}
