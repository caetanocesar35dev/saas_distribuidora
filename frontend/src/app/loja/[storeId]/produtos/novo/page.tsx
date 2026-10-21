import type { Metadata } from "next";
import { NewProductView } from "./new-product-view";

export const metadata: Metadata = { title: "Novo produto" };

export default function NewProductPage() {
  return <NewProductView />;
}
