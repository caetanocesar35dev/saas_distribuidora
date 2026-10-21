import type { Metadata } from "next";
import { BottlesView } from "./bottles-view";

export const metadata: Metadata = { title: "Vasilhames" };

export default function BottlesPage() {
  return <BottlesView />;
}
