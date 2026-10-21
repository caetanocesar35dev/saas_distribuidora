"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, Money, PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { IntInput, MoneyInput } from "@/components/app/inputs";
import { PlatformActionButton } from "@/components/app/platform-button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeletePlan, usePlatformPlans, useSavePlan } from "@/lib/api/hooks/platform";
import type { PlatformPlan } from "@/lib/api/types";
import { formatInt } from "@/lib/format";

const limit = (value: number | null) => (value === null ? "Ilimitado" : formatInt(value));

function PlanDialog({ plan, onClose }: { plan: PlatformPlan | null; onClose: () => void }) {
  const save = useSavePlan();
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState<number | undefined>(plan ? plan.priceInCents / 100 : 0);
  const [companies, setCompanies] = useState<number | undefined>(plan?.maxCompanies ?? undefined);
  const [stores, setStores] = useState<number | undefined>(plan?.maxStoresPerCompany ?? undefined);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plano" : "Novo plano"}</DialogTitle>
          <DialogDescription>
            Limites vazios significam ilimitado. A mudança vale para quem já usa o plano.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (price === undefined) return;
            save.mutate(
              {
                id: plan?.id,
                body: {
                  name: name.trim(),
                  priceInCents: Math.round(price * 100),
                  maxCompanies: companies ?? null,
                  maxStoresPerCompany: stores ?? null,
                },
              },
              {
                onSuccess: () => {
                  toast.success(plan ? "Plano atualizado." : "Plano criado.");
                  onClose();
                },
              },
            );
          }}
        >
          <FormField label="Nome do plano" htmlFor="plan-name">
            <Input
              id="plan-name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Preço por mês" htmlFor="plan-price" hint="Zero = grátis.">
            <MoneyInput id="plan-price" value={price} onChange={setPrice} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Máx. de empresas" htmlFor="plan-companies">
              <IntInput
                id="plan-companies"
                min={1}
                value={companies}
                onChange={setCompanies}
                placeholder="Ilimitado"
              />
            </FormField>
            <FormField label="Máx. de lojas por empresa" htmlFor="plan-stores">
              <IntInput
                id="plan-stores"
                min={1}
                value={stores}
                onChange={setStores}
                placeholder="Ilimitado"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={name.trim() === "" || price === undefined || save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlansView() {
  const plans = usePlatformPlans();
  const remove = useDeletePlan();
  const [dialog, setDialog] = useState<{ plan: PlatformPlan | null } | null>(null);
  const [deleting, setDeleting] = useState<PlatformPlan | null>(null);

  return (
    <div>
      <PageHeader
        title="Planos"
        description="Os planos que aparecem no cadastro, com seus limites."
        help="plataforma-planos"
        actions={
          <PlatformActionButton onClick={() => setDialog({ plan: null })}>
            <PlusIcon /> Novo plano
          </PlatformActionButton>
        }
      />
      <QueryBoundary query={plans}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="Nenhum plano cadastrado" />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Preço/mês</TableHead>
                    <TableHead className="text-right">Empresas</TableHead>
                    <TableHead className="text-right">Lojas por empresa</TableHead>
                    <TableHead className="text-right">Em uso por</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell className="text-right">
                        <Money value={plan.priceInCents / 100} />
                      </TableCell>
                      <TableCell className="text-right">{limit(plan.maxCompanies)}</TableCell>
                      <TableCell className="text-right">{limit(plan.maxStoresPerCompany)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {plan.organizations ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <PlatformActionButton
                            variant="outline"
                            size="sm"
                            onClick={() => setDialog({ plan })}
                          >
                            <PencilIcon /> Editar
                          </PlatformActionButton>
                          <PlatformActionButton
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir ${plan.name}`}
                            onClick={() => setDeleting(plan)}
                          >
                            <Trash2Icon />
                          </PlatformActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        }
      </QueryBoundary>

      {dialog && (
        <PlanDialog key={dialog.plan?.id ?? "new"} plan={dialog.plan} onClose={() => setDialog(null)} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir o plano ${deleting?.name ?? ""}?`}
        description="Só é possível excluir um plano que nenhuma organização usa."
        confirmLabel="Excluir plano"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Plano excluído.");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
