import type { Metadata } from "next";
import { TeamView } from "./team-view";

export const metadata: Metadata = { title: "Equipe" };

export default function TeamPage() {
  return <TeamView />;
}
