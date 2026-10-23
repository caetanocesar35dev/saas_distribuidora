import { CompanyShell } from "@/components/app/shell";
import { CompanyProvider } from "@/lib/session/context";

export default async function CompanyLayout({
  children,
  params,
}: LayoutProps<"/empresa/[companyId]">) {
  const { companyId } = await params;
  return (
    <CompanyProvider companyId={companyId}>
      <CompanyShell>{children}</CompanyShell>
    </CompanyProvider>
  );
}
