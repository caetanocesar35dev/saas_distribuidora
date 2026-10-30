"use client";

import { PlusIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingRows, Money, PageHeader } from "@/components/app/common";
import { ActionButton } from "@/components/app/guards";
import { HistoryButton } from "@/components/app/history-dialog";
import { Pagination } from "@/components/app/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounced } from "@/hooks/use-debounced";
import { useCustomers, useRestoreCustomer } from "@/lib/api/hooks/customers";
import type { CustomerListItem } from "@/lib/api/types";
import { debtSplit } from "@/lib/credit-warning";
import { formatAddress, formatDateTime, formatPhone } from "@/lib/format";
import { useHasRole, useStore } from "@/lib/session/context";
import { CustomerFormDialog } from "./customer-form-dialog";

/** Clientes excluídos: os dados de cadastro, a data da exclusão e o botão Reativar. */
function DeletedCustomersTable({ customers }: { customers: CustomerListItem[] }) {
  const { companyId } = useStore();
  const restore = useRestoreCustomer(companyId);

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Endereço</TableHead>
            <TableHead>Excluído em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-muted-foreground">{formatPhone(c.phone) || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{formatAddress(c) || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">
                {c.deletedAt ? formatDateTime(c.deletedAt) : "—"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <HistoryButton
                    size="xs"
                    label=""
                    target={{ scope: "company", scopeId: companyId, entity: "customers", id: c.id }}
                    title={`Histórico de ${c.name}`}
                  />
                  <ActionButton
                    variant="outline"
                    size="sm"
                    minRole="MANAGER"
                    disabled={restore.isPending}
                    onClick={() =>
                      restore.mutate(c.id, {
                        onSuccess: (restored) =>
                          toast.success(`${restored.name} voltou para a lista de clientes.`),
                      })
                    }
                  >
                    <RotateCcwIcon /> Reativar
                  </ActionButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CustomersView() {
  const { storeId, companyId, stores } = useStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(search);
  // Dívida total (todas as lojas da empresa): como no detalhe do cliente, só gerente e dono.
  // Os excluídos também são só para gerente e dono (o backend recusa o atendente).
  const isManager = useHasRole("MANAGER");
  const deleted = showDeleted && isManager;
  const list = useCustomers(companyId, {
    search: debounced.trim() || undefined,
    page,
    limit: 20,
    withDebt: (!deleted && onlyDebtors) || undefined,
    deleted: deleted || undefined,
  });
  // Só faz sentido mostrar "outras lojas" para quem trabalha em mais de uma.
  const showOthers = stores.length > 1;
  const showTotal = isManager;

  return (
    <div>
      <PageHeader
        title="Clientes e fiado"
        description="Cadastro de clientes, dívidas do fiado e vasilhames emprestados."
        help="clientes-cadastrar"
        actions={
          <ActionButton onClick={() => setCreating(true)}>
            <PlusIcon /> Novo cliente
          </ActionButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative w-full max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou telefone"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Buscar clientes"
          />
        </div>
        {!deleted && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={onlyDebtors}
              onCheckedChange={(checked) => {
                setOnlyDebtors(checked);
                setPage(1);
              }}
            />
            Só quem deve no fiado
          </label>
        )}
        {isManager && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={showDeleted}
              onCheckedChange={(checked) => {
                setShowDeleted(checked);
                setPage(1);
              }}
            />
            Mostrar só os excluídos
          </label>
        )}
      </div>

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title={
            deleted
              ? "Nenhum cliente excluído"
              : onlyDebtors
                ? "Nenhum cliente devendo no fiado"
                : "Nenhum cliente encontrado"
          }
          description={
            debounced
              ? "Tente outra busca."
              : deleted
                ? "Os clientes que você excluir aparecem aqui, com os dados de cadastro, para reativar."
                : onlyDebtors
                  ? "Ninguém deve no fiado nas suas lojas."
                  : "Cadastre o primeiro cliente."
          }
        />
      ) : deleted ? (
        <div className="space-y-2">
          <DeletedCustomersTable customers={list.data.data} />
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Dívida nesta loja</TableHead>
                  {showOthers && <TableHead className="text-right">Outras lojas</TableHead>}
                  {showTotal && <TableHead className="text-right">Dívida total</TableHead>}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((c) => {
                  const debt = debtSplit(c.debts, storeId);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatPhone(c.phone) || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {debt.here > 0 ? (
                          <Money value={debt.here} className="font-medium text-destructive" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {showOthers && (
                        <TableCell className="text-right">
                          {debt.others > 0 ? (
                            <Money value={debt.others} className="text-destructive" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {showTotal && (
                        <TableCell className="text-right">
                          {debt.total > 0 ? (
                            <Money value={debt.total} className="font-semibold text-destructive" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <Link
                          href={`/loja/${storeId}/clientes/${c.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Abrir
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </div>
      )}

      {creating && (
        <CustomerFormDialog
          companyId={companyId}
          customer={null}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
