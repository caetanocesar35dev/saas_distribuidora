import type { Metadata } from "next";
import { HelpHome } from "./help-home";

export const metadata: Metadata = { title: "Dúvidas" };

export default function HelpPage() {
  return <HelpHome />;
}
