import type { Metadata } from "next";
import { Suspense } from "react";
import { ReferralsView } from "./referrals-view";

export const metadata: Metadata = { title: "Indicações" };

export default function ReferralsPage() {
  // A lista lê o filtro de representante da URL (?representante=), o que exige o Suspense.
  return (
    <Suspense>
      <ReferralsView />
    </Suspense>
  );
}
