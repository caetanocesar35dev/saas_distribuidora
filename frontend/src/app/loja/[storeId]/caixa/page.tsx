import type { Metadata } from "next";
import { CashView } from "./cash-view";

export const metadata: Metadata = { title: "Caixa" };

export default function CashPage() {
  return <CashView />;
}
