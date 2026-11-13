"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NO_CATEGORY, useCategoryOptions } from "@/components/app/category-filter";
import { PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { ActionButton, PageGuard } from "@/components/app/guards";
import { IntInput, SelectField } from "@/components/app/inputs";
import { PackNameInput } from "@/components/app/pack-name-input";
import { PriceFields } from "@/components/app/price-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useStores } from "@/lib/api/hooks/admin";
import {
  extractRestorableId,
  useBottleTypes,
  useCreateProduct,
  useRestoreProduct,
} from "@/lib/api/hooks/catalog";
import { errorMessage } from "@/lib/api/client";
import type { Store } from "@/lib/api/types";
import { packLabel } from "@/lib/format";
import { type PriceDraft, resolvePrices } from "@/lib/pack-pricing";
import { useStore } from "@/lib/session/context";

const NO_BOTTLE = "none";

function NewProductForm({ companyStores }: { companyStores: Store[] }) {
  const router = useRouter();
  const { companyId, storeId } = useStore();
  const create = useCreateProduct(companyId, storeId);
  const restore = useRestoreProduct(companyId, storeId);
  const bottleTypes = useBottleTypes(companyId);
  const categoryOptions = useCategoryOptions(companyId);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState(NO_CATEGORY);
  const [packName, setPackName] = useState("");
  const [pack, setPack] = useState<number | undefined>(1);
  const [bottleTypeId, setBottleTypeId] = useState(NO_BOTTLE);
  const [defaults, setDefaults] = useState<PriceDraft>({});
  // A loja onde a pessoa está já vem marcada: é o caso mais comum.
  const [offers, setOffers] = useState<Record<string, PriceDraft>>({ [storeId]: {} });
  const [error, setError] = useState<string | null>(null);
  const [restorableId, setRestorableId] = useState<string | null>(null);

  const chosen = Object.entries(offers);
  const packSize = pack ?? 1;
  // Loja sem preço próprio usa o preço padrão.
  const resolved = chosen.map(([id, o]) => ({
    storeId: id,
    ...resolvePrices(o, packSize, defaults),
  }));
  const everyPriceFilled = resolved.every((o) => o.price !== undefined);
  const valid = name.trim() !== "" && !!pack && pack >= 1 && everyPriceFilled;

  function toggle(id: string, checked: boolean) {
    setOffers((prev) => {
      const next = { ...prev };
      if (checked) next[id] = {};
      else delete next[id];
      return next;
    });
  }

  function patchOffer(id: string, patch: Partial<PriceDraft>) {
    setOffers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function submit() {
    setError(null);
    setRestorableId(null);
    create.mutate(
      {
        name: name.trim(),
        code: code.trim() || undefined,
        packQuantity: pack,
        packName: packName.trim() || undefined,
        categoryId: categoryId === NO_CATEGORY ? undefined : categoryId,
        bottleTypeId: bottleTypeId === NO_BOTTLE ? undefined : bottleTypeId,
        stores: resolved.length
          ? resolved.map((o) => ({ ...o, price: o.price as number }))
          : undefined,
      },
      {
        onSuccess: (product) => {
          toast.success(`${product.name} cadastrado.`);
          router.push(`/loja/${storeId}/estoque`);
        },
        onError: (err) => {
          const message = errorMessage(err);
          setError(message);
          setRestorableId(extractRestorableId(message));
        },
      },
    );
  }

  return (
    <form
      className="max-w-3xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Dados do produto</h2>
        <FormField label="Nome do produto" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Código de barras (opcional)"
            htmlFor="code"
            hint="Se deixar vazio, o sistema gera um código sozinho."
          >
            <Input
              id="code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Passe o leitor aqui"
            />
          </FormField>
          <FormField label="Categoria (opcional)" htmlFor="category">
            <SelectField
              id="category"
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
            />
          </FormField>
          <FormField
            label="Nome da embalagem (opcional)"
            htmlFor="pack-name"
            hint="Fardo, caixa, pacote... Se ficar vazio, aparece fardo."
          >
            <PackNameInput id="pack-name" value={packName} onChange={setPackName} />
          </FormField>
          <FormField
            label={`Unidades por ${packLabel(packName)}`}
            htmlFor="pack"
            hint="Deixe 1 se o produto só é vendido por unidade."
          >
            <IntInput id="pack" min={1} value={pack} onChange={setPack} />
          </FormField>
        </div>
        <FormField
          label="Vasilhame (opcional)"
          htmlFor="bottle"
          hint="Se o produto sai com vasilhame, cada unidade vendida leva um vasilhame do cliente."
        >
          <SelectField
            id="bottle"
            value={bottleTypeId}
            onChange={setBottleTypeId}
            options={[
              { value: NO_BOTTLE, label: "Sem vasilhame" },
              ...(bottleTypes.data ?? []).map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </FormField>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Em quais lojas este produto é vendido?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada loja tem o seu preço. O estoque começa em zero: depois registre a entrada de
            mercadoria em Estoque.
          </p>
        </div>
        <div className="space-y-2">
          <PriceFields
            idPrefix="default"
            packSize={packSize}
            packName={packName}
            suffix=" padrão"
            value={defaults}
            onChange={(patch) => setDefaults((prev) => ({ ...prev, ...patch }))}
          />
          <p className="text-xs text-muted-foreground">
            Os valores padrão valem para as lojas marcadas, mas cada loja pode ter os seus. O custo é
            opcional.
          </p>
        </div>
        <ul className="space-y-2">
          {companyStores.map((store) => {
            const offer = offers[store.id];
            return (
              <li key={store.id} className="rounded-lg border p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={offer !== undefined}
                    onCheckedChange={(checked) => toggle(store.id, checked)}
                  />
                  {store.name}
                </label>
                {offer && (
                  <div className="mt-3">
                    <PriceFields
                      idPrefix={`store-${store.id}`}
                      packSize={packSize}
                      packName={packName}
                      suffix=" nesta loja"
                      value={offer}
                      fallback={defaults}
                      onChange={(patch) => patchOffer(store.id, patch)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {error && (
        <div role="alert" className="space-y-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p>{error}</p>
          {restorableId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={restore.isPending}
              onClick={() =>
                restore.mutate(restorableId, {
                  onSuccess: (product) => {
                    toast.success(`${product.name} foi reativado.`);
                    router.push(`/loja/${storeId}/estoque`);
                  },
                })
              }
            >
              {restore.isPending ? "Reativando..." : "Reativar o produto excluído"}
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <ActionButton type="submit" minRole="MANAGER" disabled={!valid || create.isPending}>
          {create.isPending ? "Salvando..." : "Cadastrar produto"}
        </ActionButton>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function NewProductView() {
  const { companyId, storeId } = useStore();
  const stores = useStores(companyId);

  return (
    <div>
      <Link
        href={`/loja/${storeId}/produtos`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeftIcon className="size-4" /> Produtos
      </Link>
      <PageHeader title="Novo produto" help="produtos-cadastrar" />
      <PageGuard min="MANAGER">
        <QueryBoundary query={stores}>
          {(list) => <NewProductForm companyStores={list} />}
        </QueryBoundary>
      </PageGuard>
    </div>
  );
}
