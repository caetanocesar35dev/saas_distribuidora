import type { Metadata } from "next";
import { RepresentativesView } from "./representatives-view";

export const metadata: Metadata = { title: "Representantes" };

export default function RepresentativesPage() {
  return <RepresentativesView />;
}
