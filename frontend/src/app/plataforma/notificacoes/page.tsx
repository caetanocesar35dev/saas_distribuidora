import type { Metadata } from "next";
import { PlatformNotificationsView } from "./notifications-view";

export const metadata: Metadata = { title: "Notificações da plataforma" };

export default function PlatformNotificationsPage() {
  return <PlatformNotificationsView />;
}
