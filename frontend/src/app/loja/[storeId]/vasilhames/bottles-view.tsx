"use client";

import { ArrowDownToLineIcon, ArrowUpFromLineIcon, SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/common";
import { ActionButton, RequireRole } from "@/components/app/guards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ManualBottleMovementType } from "@/lib/api/types";
import { MovementDialog } from "./movement-dialog";
import { MovementsTab } from "./movements-tab";
import { StockTab } from "./stock-tab";
import { TypesTab } from "./types-tab";

export function BottlesView() {
  const [movement, setMovement] = useState<ManualBottleMovementType | null>(null);

  return (
    <div>
      <PageHeader
        title="Vasilhames"
        description="Estoque de vasilhames desta loja, o que entra e sai e os tipos cadastrados."
        help="vasilhames-estoque"
        actions={
          <>
            <ActionButton variant="outline" onClick={() => setMovement("SUPPLIER_SEND")}>
              <ArrowUpFromLineIcon /> Enviar ao fornecedor
            </ActionButton>
            <ActionButton variant="outline" onClick={() => setMovement("SUPPLIER_RECEIVE")}>
              <ArrowDownToLineIcon /> Receber do fornecedor
            </ActionButton>
            <RequireRole min="MANAGER">
              <ActionButton
                variant="outline"
                minRole="MANAGER"
                onClick={() => setMovement("MANUAL_ADJUSTMENT")}
              >
                <SlidersHorizontalIcon /> Ajuste manual
              </ActionButton>
            </RequireRole>
          </>
        }
      />

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Estoque</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <RequireRole min="MANAGER">
            <TabsTrigger value="types">Tipos de vasilhame</TabsTrigger>
          </RequireRole>
        </TabsList>
        <TabsContent value="stock">
          <StockTab />
        </TabsContent>
        <TabsContent value="movements">
          <MovementsTab />
        </TabsContent>
        <TabsContent value="types">
          <TypesTab />
        </TabsContent>
      </Tabs>

      {movement && (
        <MovementDialog key={movement} type={movement} onClose={() => setMovement(null)} />
      )}
    </div>
  );
}
