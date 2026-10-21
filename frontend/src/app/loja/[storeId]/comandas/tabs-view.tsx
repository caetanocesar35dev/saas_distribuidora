"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingRows, Money, PageHeader } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { ActionButton } from "@/components/app/guards";
import { CustomerPicker, type PickedCustomer } from "@/components/app/pos/customer-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCommandTabs, useCreateCommandTab } from "@/lib/api/hooks/sales";
import type { TabStatus } from "@/lib/api/types";
import { formatDateTime, formatInt } from "@/lib/format";
import { useStore } from "@/lib/session/context";

function NewTabDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { storeId, companyId } = useStore();
  const create = useCreateCommandTab(storeId);
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova comanda</DialogTitle>
          <DialogDescription>
            Dê um nome para identificar (ex.: Mesa 4, João do balcão).
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { name: name.trim(), customerId: customer?.id },
              {
                onSuccess: (tab) => {
                  toast.success("Comanda aberta.");
                  router.push(`/loja/${storeId}/comandas/${tab.id}`);
                },
              },
            );
          }}
        >
          <FormField label="Nome da comanda" htmlFor="tab-name">
            <Input
              id="tab-name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Cliente (opcional)" htmlFor="tab-customer">
            <CustomerPicker companyId={companyId} value={customer} onChange={setCustomer} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={name.trim() === "" || create.isPending}>
              {create.isPending ? "Abrindo..." : "Abrir comanda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TabsList_({ status }: { status: TabStatus }) {
  const { storeId } = useStore();
  const tabs = useCommandTabs(storeId, status);

  if (tabs.isPending) return <LoadingRows rows={3} />;
  if (tabs.isError) return <ErrorState error={tabs.error} onRetry={() => void tabs.refetch()} />;
  if (tabs.data.length === 0) {
    return (
      <EmptyState
        title={status === "OPEN" ? "Nenhuma comanda aberta" : "Nenhuma comanda fechada"}
        description={status === "OPEN" ? "Abra uma comanda para ir lançando os itens." : undefined}
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tabs.data.map((tab) => (
        <li key={tab.id}>
          <Link
            href={`/loja/${storeId}/comandas/${tab.id}`}
            className="flex h-full flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{tab.name}</span>
              <Money value={tab.total} className="font-semibold" />
            </span>
            <span className="text-xs text-muted-foreground">
              {tab.customer ? `${tab.customer.name} · ` : ""}
              {formatInt(tab.items.length)} {tab.items.length === 1 ? "item" : "itens"} · aberta em{" "}
              {formatDateTime(tab.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TabsView() {
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Comandas"
        description="Contas abertas que são fechadas depois. O estoque baixa quando o item é lançado."
        help="comandas-abrir"
        actions={
          <ActionButton onClick={() => setCreating(true)}>
            <PlusIcon /> Nova comanda
          </ActionButton>
        }
      />
      <Tabs defaultValue="OPEN">
        <TabsList>
          <TabsTrigger value="OPEN">Abertas</TabsTrigger>
          <TabsTrigger value="CLOSED">Fechadas</TabsTrigger>
        </TabsList>
        <TabsContent value="OPEN">
          <TabsList_ status="OPEN" />
        </TabsContent>
        <TabsContent value="CLOSED">
          <TabsList_ status="CLOSED" />
        </TabsContent>
      </Tabs>
      {creating && <NewTabDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
