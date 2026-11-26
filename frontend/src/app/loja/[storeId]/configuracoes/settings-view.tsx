"use client";

import { PageHeader } from "@/components/app/common";
import { PageGuard } from "@/components/app/guards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStore } from "@/lib/session/context";
import { CategoriesManager } from "./categories-manager";
import { ChannelsManager } from "./channels-manager";
import { SuppliersManager } from "./suppliers-manager";

/**
 * Configurações (gerente e dono): as listas que valem para todas as lojas da empresa. Os dados da
 * loja ficam em Lojas e os da conta em Minha conta.
 */
export function SettingsView() {
  const { companyId } = useStore();
  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Listas usadas em todas as lojas da empresa."
        help="gestao-configuracoes"
      />
      <PageGuard min="MANAGER">
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card role="region" aria-labelledby="config-origens">
            <CardHeader>
              <CardTitle id="config-origens" role="heading" aria-level={2}>
                Origens da venda
              </CardTitle>
              <CardDescription>
                De onde vêm as vendas (balcão, WhatsApp, iFood...). A padrão já vem marcada no
                fechamento da venda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChannelsManager companyId={companyId} />
            </CardContent>
          </Card>
          <Card role="region" aria-labelledby="config-categorias">
            <CardHeader>
              <CardTitle id="config-categorias" role="heading" aria-level={2}>
                Categorias de produto
              </CardTitle>
              <CardDescription>
                Servem para filtrar os produtos e ver o faturamento por categoria no painel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoriesManager companyId={companyId} />
            </CardContent>
          </Card>
          <Card role="region" aria-labelledby="config-fornecedores">
            <CardHeader>
              <CardTitle id="config-fornecedores" role="heading" aria-level={2}>
                Fornecedores
              </CardTitle>
              <CardDescription>
                Com quem a loja troca vasilhames. Escolha o fornecedor ao enviar ou receber
                vasilhames para ver o saldo de cascos com cada um.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SuppliersManager companyId={companyId} />
            </CardContent>
          </Card>
        </div>
      </PageGuard>
    </div>
  );
}
