"use client";

import { DashboardView } from "@/components/app/dashboard-view";
import { PageHeader, QueryBoundary } from "@/components/app/common";
import { RequireCompanyAdminPage } from "@/components/app/guards";
import { useCompanyDashboard } from "@/lib/api/hooks/dashboard";
import { useCompany } from "@/lib/session/context";

function CompanyDashboard() {
  const company = useCompany();
  const dashboard = useCompanyDashboard(company.companyId);
  return (
    <QueryBoundary query={dashboard}>
      {(data) => <DashboardView data={data} storeHref={(id) => `/loja/${id}`} />}
    </QueryBoundary>
  );
}

export function CompanyHome() {
  const company = useCompany();
  return (
    <div>
      <PageHeader
        title="Painel da empresa"
        description={`${company.companyName} · todas as lojas juntas`}
        help="gestao-painel"
      />
      <RequireCompanyAdminPage>
        <CompanyDashboard />
      </RequireCompanyAdminPage>
    </div>
  );
}
