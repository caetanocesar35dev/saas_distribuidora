import type { Metadata } from "next";
import { OrganizationDetailView } from "./organization-detail-view";

export const metadata: Metadata = { title: "Organização" };

export default async function OrganizationDetailPage({
  params,
}: PageProps<"/plataforma/organizacoes/[orgId]">) {
  const { orgId } = await params;
  return <OrganizationDetailView orgId={orgId} />;
}
