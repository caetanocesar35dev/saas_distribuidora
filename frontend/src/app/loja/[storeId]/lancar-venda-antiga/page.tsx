import type { Metadata } from "next";
import { PageGuard } from "@/components/app/guards";
import { PosView } from "../pdv/pos-view";

export const metadata: Metadata = { title: "Lançar venda antiga" };

/** Venda antiga lançada depois (internet caiu etc.): só gerente e dono (decisão do usuário). */
export default function LateSalePage() {
  return (
    <PageGuard min="MANAGER">
      <PosView late />
    </PageGuard>
  );
}
