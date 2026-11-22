import type { Metadata } from "next";
import { HelpHome } from "./help-home";

export const metadata: Metadata = {
  title: "Central de Dúvidas",
  description:
    "Passo a passo de cada tela do Minha Distribuidora Online: PDV, caixa, comandas, estoque, vasilhames, fiado, equipe e assinatura.",
  alternates: { canonical: "/duvidas" },
};

export default function HelpPage() {
  return <HelpHome />;
}
