"use client";

import {
  ArrowDownToLineIcon,
  ClipboardCheckIcon,
  CircleDollarSignIcon,
  MoreVerticalIcon,
  PackagePlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, ErrorState, LoadingRows, Money, PageHeader } from "@/components/app/common";
import { ActionButton, RequireRole } from "@/components/app/guards";
import { HistoryButton } from "@/components/app/history-dialog";
import { SelectField } from "@/components/app/inputs";
import { Pagination } from "@/components/app/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounced } from "@/hooks/use-debounced";
import {
  useLowStock,
  useRemoveStoreProduct,
  useStoreProducts,
  useUpdateStoreProduct,
} from "@/lib/api/hooks/catalog";
import type { StoreProduct } from "@/lib/api/types";
import { formatInt, hasMinRole } from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { AddToStoreDialog } from "./add-to-store-dialog";
import { PriceDialog, StockAdjustDialog, StockEntryDialog } from "./stock-dialogs";

type Dialogs =
  | { kind: "entry"; item: StoreProduct }
  | { kind: "adjust"; item: StoreProduct }
  | { kind: "price"; item: StoreProduct }
  | { kind: "remove"; item: StoreProduct }
  | null;

type StatusFilter = "all" | "active" | "inactive";

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge variant="destructive">Sem estoque</Badge>;
  return <span className="tabular-nums">{formatInt(stock)}</span>;
}

function ProductRow({
  item,
  manager,
  onDialog,
}: {
  item: StoreProduct;
  manager: boolean;
  onDialog: (d: Dialogs) => void;
}) {
  const { storeId } = useStore();
  const update = useUpdateStoreProduct(storeId);

  return (
    <TableRow className={item.isActive ? undefined : "opacity-60"}>
      <TableCell>
        <p className="font-medium">{item.product.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.product.code}
          {item.product.bottleType && ` · vasilhame: ${item.product.bottleType.name}`}
        </p>
      </TableCell>
      <TableCell className="text-right">
        <Money value={item.price} />
      </TableCell>
      {manager && (
        <TableCell className="text-right">
          <Money value={item.costPrice} />
        </TableCell>
      )}
      <TableCell className="text-right">
        <StockBadge stock={item.stock} />
      </TableCell>
      <TableCell>
        {item.isActive ? <Badge variant="secondary">À venda</Badge> : <Badge variant="outline">Pausado</Badge>}
      </TableCell>
      {manager && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <ActionButton
              variant="outline"
              size="sm"
              minRole="MANAGER"
              onClick={() => onDialog({ kind: "entry", item })}
            >
              <ArrowDownToLineIcon /> Entrada
            </ActionButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" aria-label="Mais ações" />}
              >
                <MoreVerticalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onDialog({ kind: "adjust", item })}>
                  <ClipboardCheckIcon /> Ajuste de inventário
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDialog({ kind: "price", item })}>
                  <CircleDollarSignIcon /> Preço e custo
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    update.mutate(
                      { id: item.id, body: { isActive: !item.isActive } },
                      {
                        onSuccess: () =>
                          toast.success(
                            item.isActive ? "Venda pausada nesta loja." : "Voltou a ser vendido.",
                          ),
                      },
                    )
                  }
                >
                  {item.isActive ? "Pausar a venda" : "Voltar a vender"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDialog({ kind: "remove", item })}>
                  <Trash2Icon /> Tirar da loja
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <HistoryButton
              size="xs"
              label=""
              target={{ scope: "store", scopeId: storeId, entity: "store-products", id: item.id }}
              title={`Histórico de ${item.product.name}`}
            />
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

function ProductsTable({ onDialog }: { onDialog: (d: Dialogs) => void }) {
  const { storeId, role } = useStore();
  const manager = hasMinRole(role, "MANAGER");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);

  const list = useStoreProducts(storeId, {
    search: debounced || undefined,
    isActive: status === "all" ? undefined : status === "active",
    page,
    limit: 20,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou código de barras"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Buscar produtos"
          />
        </div>
        <SelectField<StatusFilter>
          className="w-44"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Todos" },
            { value: "active", label: "À venda" },
            { value: "inactive", label: "Pausados" },
          ]}
        />
      </div>

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description={
            debounced
              ? "Tente outra busca."
              : "Coloque produtos nesta loja para vender e controlar o estoque."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  {manager && <TableHead className="text-right">Custo</TableHead>}
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Situação</TableHead>
                  {manager && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((item) => (
                  <ProductRow key={item.id} item={item} manager={manager} onDialog={onDialog} />
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function LowStockTable() {
  const { storeId } = useStore();
  const low = useLowStock(storeId, true);

  if (low.isPending) return <LoadingRows rows={3} />;
  if (low.isError) return <ErrorState error={low.error} onRetry={() => void low.refetch()} />;
  if (low.data.length === 0) {
    return <EmptyState title="Nenhum produto com estoque baixo" description="Tudo certo por aqui." />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead className="text-right">Estoque</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {low.data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <p className="font-medium">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">{item.product.code}</p>
              </TableCell>
              <TableCell className="text-right">
                <StockBadge stock={item.stock} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function StockView() {
  const { storeId } = useStore();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [adding, setAdding] = useState(false);
  const remove = useRemoveStoreProduct(storeId);
  const close = () => setDialog(null);

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="Produtos vendidos nesta loja, com preço e quantidade."
        help="produtos-estoque"
        actions={
          <RequireRole min="MANAGER">
            <ActionButton minRole="MANAGER" onClick={() => setAdding(true)}>
              <PackagePlusIcon /> Colocar produto na loja
            </ActionButton>
          </RequireRole>
        }
      />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos os produtos</TabsTrigger>
          <RequireRole min="MANAGER">
            <TabsTrigger value="low">Estoque baixo</TabsTrigger>
          </RequireRole>
        </TabsList>
        <TabsContent value="all">
          <ProductsTable onDialog={setDialog} />
        </TabsContent>
        <TabsContent value="low">
          <LowStockTable />
        </TabsContent>
      </Tabs>

      {dialog?.kind === "entry" && (
        <StockEntryDialog key={dialog.item.id} storeId={storeId} item={dialog.item} onClose={close} />
      )}
      {dialog?.kind === "adjust" && (
        <StockAdjustDialog key={dialog.item.id} storeId={storeId} item={dialog.item} onClose={close} />
      )}
      {dialog?.kind === "price" && (
        <PriceDialog key={dialog.item.id} storeId={storeId} item={dialog.item} onClose={close} />
      )}
      <AddToStoreDialog open={adding} onClose={() => setAdding(false)} />

      <ConfirmDialog
        open={dialog?.kind === "remove"}
        onOpenChange={(open) => !open && close()}
        title="Tirar o produto desta loja?"
        description={`${dialog?.item.product.name ?? ""} deixa de ser vendido aqui e some desta lista. Nas outras lojas nada muda. Para só parar de vender por um tempo, use "Pausar a venda".`}
        confirmLabel="Tirar da loja"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          dialog?.kind === "remove" &&
          remove.mutate(dialog.item.id, {
            onSuccess: () => {
              toast.success("Produto retirado da loja.");
              close();
            },
          })
        }
      />
    </div>
  );
}
