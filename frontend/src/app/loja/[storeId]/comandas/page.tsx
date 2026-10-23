import type { Metadata } from "next";
import { TabsView } from "./tabs-view";

export const metadata: Metadata = { title: "Comandas" };

export default function CommandTabsPage() {
  return <TabsView />;
}
