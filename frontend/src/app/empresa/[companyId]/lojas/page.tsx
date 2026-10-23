import type { Metadata } from "next";
import { StoresView } from "./stores-view";

export const metadata: Metadata = { title: "Lojas" };

export default function StoresPage() {
  return <StoresView />;
}
