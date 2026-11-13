"use client";

import { PencilIcon, PlusIcon, RotateCcwIcon, SearchIcon, TagsIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryFilter, NO_CATEGORY, useCategoryOptions } from "@/components/app/category-filter";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { ActionButton, PageGuard } from "@/components/app/guards";
import { HistoryButton } from "@/components/app/history-dialog";
import { IntInput, SelectField } from "@/components/app/inputs";
import { LinkButton } from "@/components/app/link-button";
import { PackNameInput } from "@/components/app/pack-name-input";
import { Pagination } from "@/components/app/pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useDebounced } from "@/hooks/use-debounced";
import {
  useBottleTypes,
  useDeleteProduct,
  useProducts,
  useRestoreProduct,
  useUpdateProduct,
} from "@/lib/api/hooks/catalog";
import type { Product } from "@/lib/api/types";
import { capitalize, hasMinRole, packLabel } from "@/lib/format";
import { useStore } from "@/lib/session/context";
import { CategoriesDialog } from "./categories-dialog";

const NO_BOTTLE = "none";

function EditProductDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { companyId, storeId } = useStore();
  const update = useUpdateProduct(companyId, storeId);
  const bottleTypes = useBottleTypes(companyId);
  const categoryOptions = useCategoryOptions(companyId);
  const [name, setName] = useState(product.name);
  const [pack, setPack] = useState<number | undefined>(product.packQuantity);
  const [packName, setPackName] = useState(product.packName ?? "");
  const [bottleTypeId, setBottleTypeId] = useState(product.bottleTypeId ?? NO_BOTTLE);
  const [categoryId, setCategoryId] = useState(product.categoryId ?? NO_CATEGORY);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar produto</DialogTitle>
          <DialogDescription>
            Código de barras {product.code}. O nome e o vasilhame valem para todas as lojas; o
            preço é de cada loja (em Estoque).
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              {
                id: product.id,
                body: {
                  name: name.trim(),
                  packQuantity: pack,
                  packName: packName.trim() || null,
                  bottleTypeId: bottleTypeId === NO_BOTTLE ? null : bottleTypeId,
                  categoryId: categoryId === NO_CATEGORY ? null : categoryId,
                },
              },
              {
                onSuccess: () => {
                  toast.success("Produto atualizado.");
                  onClose();
                },
              },
            );
          }}
        >
          <FormField label="Nome do produto" htmlFor="edit-name">
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Categoria" htmlFor="edit-category">
            <SelectField
              id="edit-category"
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Nome da embalagem"
              htmlFor="edit-pack-name"
              hint="Fardo, caixa, pacote... Só muda o nome nas telas."
            >
              <PackNameInput id="edit-pack-name" value={packName} onChange={setPackName} />
            </FormField>
            <FormField label={`Unidades por ${packLabel(packName)}`} htmlFor="edit-pack">
              <IntInput id="edit-pack" min={1} value={pack} onChange={setPack} />
            </FormField>
          </div>
          <FormField
            label="Vasilhame"
            htmlFor="edit-bottle"
            hint="Se o produto sai com vasilhame, o cliente leva um por unidade vendida."
          >
            <SelectField
              id="edit-bottle"
              value={bottleTypeId}
              onChange={setBottleTypeId}
              options={[
                { value: NO_BOTTLE, label: "Sem vasilhame" },
                ...(bottleTypes.data ?? []).map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={name.trim() === "" || !pack || update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductsList() {
  const { companyId, storeId } = useStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showDeleted, setShowDeleted] = useState(false);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const debounced = useDebounced(search);
  const list = useProducts(companyId, {
    search: debounced || undefined,
    categoryId,
    page,
    limit: 20,
    deleted: showDeleted || undefined,
  });
  const remove = useDeleteProduct(companyId, storeId);
  const restore = useRestoreProduct(companyId, storeId);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-md">
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
        <CategoryFilter
          className="w-52"
          companyId={companyId}
          value={categoryId}
          onChange={(value) => {
            setCategoryId(value);
            setPage(1);
          }}
        />
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
      </div>

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title={showDeleted ? "Nenhum produto excluído" : "Nenhum produto cadastrado"}
          description={
            debounced || categoryId
              ? "Tente outra busca ou outra categoria."
              : showDeleted
                ? "Os produtos que você excluir aparecem aqui para reativar."
                : "Cadastre o primeiro produto da empresa."
          }
          action={
            !debounced &&
            !categoryId &&
            !showDeleted && (
              <LinkButton href={`/loja/${storeId}/produtos/novo`}>
                <PlusIcon /> Novo produto
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Código de barras</TableHead>
                  <TableHead>Embalagem</TableHead>
                  <TableHead>Vasilhame</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category?.name ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{product.code}</TableCell>
                    <TableCell className="tabular-nums">
                      {product.packQuantity > 1
                        ? `${capitalize(packLabel(product.packName))} de ${product.packQuantity}`
                        : "—"}
                    </TableCell>
                    <TableCell>{product.bottleType?.name ?? "—"}</TableCell>
                    <TableCell>
                      {product.deletedAt ? (
                        <div className="flex justify-end">
                          <ActionButton
                            variant="outline"
                            size="sm"
                            minRole="MANAGER"
                            disabled={restore.isPending}
                            onClick={() =>
                              restore.mutate(product.id, {
                                onSuccess: (restored) =>
                                  toast.success(
                                    `${restored.name} foi reativado, com o preço e o estoque de antes nas lojas.`,
                                  ),
                              })
                            }
                          >
                            <RotateCcwIcon /> Reativar
                          </ActionButton>
                        </div>
                      ) : (
                      <div className="flex justify-end gap-1">
                        <HistoryButton
                          size="xs"
                          label=""
                          target={{
                            scope: "company",
                            scopeId: companyId,
                            entity: "products",
                            id: product.id,
                          }}
                          title={`Histórico de ${product.name}`}
                        />
                        <ActionButton
                          variant="outline"
                          size="sm"
                          minRole="MANAGER"
                          onClick={() => setEditing(product)}
                        >
                          <PencilIcon /> Editar
                        </ActionButton>
                        <ActionButton
                          variant="ghost"
                          size="icon-sm"
                          minRole="MANAGER"
                          aria-label={`Excluir ${product.name}`}
                          onClick={() => setDeleting(product)}
                        >
                          <Trash2Icon />
                        </ActionButton>
                      </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </>
      )}

      {editing && <EditProductDialog key={editing.id} product={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir ${deleting?.name ?? "o produto"}?`}
        description="O produto sai do catálogo e de todas as lojas. Para trazê-lo de volta (com o preço e o estoque de antes), marque Mostrar só os excluídos e clique em Reativar."
        confirmLabel="Excluir produto"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Produto excluído.");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}

export function ProductsView() {
  const { companyId, storeId, role } = useStore();
  const [managingCategories, setManagingCategories] = useState(false);
  return (
    <div>
      <PageHeader
        title="Produtos"
        description="O catálogo da empresa. O preço e o estoque de cada loja ficam em Estoque."
        help="produtos-cadastrar"
        actions={
          <>
            {hasMinRole(role, "MANAGER") && (
              <ActionButton
                variant="outline"
                minRole="MANAGER"
                onClick={() => setManagingCategories(true)}
              >
                <TagsIcon /> Categorias
              </ActionButton>
            )}
            <LinkButton href={`/loja/${storeId}/produtos/novo`}>
              <PlusIcon /> Novo produto
            </LinkButton>
          </>
        }
      />
      <PageGuard min="MANAGER">
        <ProductsList />
      </PageGuard>
      {managingCategories && (
        <CategoriesDialog companyId={companyId} onClose={() => setManagingCategories(false)} />
      )}
    </div>
  );
}
