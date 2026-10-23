import type { Metadata } from "next";
import { StoreHome } from "./store-home";

export const metadata: Metadata = { title: "Início" };

export default function StoreHomePage() {
  return <StoreHome />;
}
