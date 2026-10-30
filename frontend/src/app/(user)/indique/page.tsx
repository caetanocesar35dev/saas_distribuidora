import type { Metadata } from "next";
import { ReferralView } from "./referral-view";

export const metadata: Metadata = { title: "Indique e ganhe" };

export default function ReferralPage() {
  return <ReferralView />;
}
