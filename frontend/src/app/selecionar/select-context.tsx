"use client";

import { BuildingIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Brand } from "@/components/app/brand";
import { ErrorState, LoadingRows } from "@/components/app/common";
import { UserMenu } from "@/components/app/user-menu";
import { ROLE_LABEL } from "@/lib/format";
import { getValidLastSelection } from "@/lib/session/last-selection";
import { useMe, useMemberships } from "@/lib/session/queries";

/**
 * Escolha de empresa e loja. Com uma única loja, entra direto; vindo do login, volta para a última
 * loja usada (se o acesso ainda existir). Com `?trocar=1` sempre mostra a lista.
 */
export function SelectContext() {
  const router = useRouter();
  const switching = useSearchParams().get("trocar") === "1";
  const memberships = useMemberships();
  const me = useMe();
  const data = memberships.data;

  useEffect(() => {
    if (!data || switching) return;
    const stores = data.flatMap((m) => m.stores);
    if (stores.length === 1) {
      router.replace(`/loja/${stores[0].storeId}`);
      return;
    }
    const last = getValidLastSelection(data);
    if (last) router.replace(`/loja/${last.storeId}`);
  }, [data, switching, router]);

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="flex items-center justify-between border-b bg-background px-4 py-2">
        <Brand />
        <UserMenu />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Escolha onde trabalhar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você pode trocar de empresa ou loja a qualquer momento pelo topo da tela.
        </p>

        <div className="mt-6 space-y-6">
          {memberships.isPending && <LoadingRows rows={3} />}
          {memberships.isError && (
            <ErrorState error={memberships.error} onRetry={() => void memberships.refetch()} />
          )}

          {data?.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-center">
              <p className="font-medium">Você ainda não tem acesso a nenhuma loja</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Peça ao dono da distribuidora para convidar você pelo seu e-mail. Se foi convidado,
                use o link que chegou por e-mail para criar a senha.
              </p>
              <Link
                href="/duvidas/acesso-convite"
                className="mt-3 inline-block text-sm text-primary hover:underline"
              >
                Ver como funciona o convite
              </Link>
              {me.data?.platformRole && (
                <p className="mt-3 text-sm">
                  Você é da equipe da plataforma:{" "}
                  <Link href="/plataforma/organizacoes" className="text-primary hover:underline">
                    abrir a área da plataforma
                  </Link>
                </p>
              )}
            </div>
          )}

          {data?.map((company) => (
            <section key={company.companyId} className="rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <BuildingIcon className="size-4 text-muted-foreground" />
                <h2 className="font-medium">{company.companyName}</h2>
              </div>
              <ul className="divide-y">
                {company.stores.map((store) => (
                  <li key={store.storeId}>
                    <Link
                      href={`/loja/${store.storeId}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <StoreIcon className="size-4 text-muted-foreground" />
                      <span className="flex-1 font-medium">{store.storeName}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {ROLE_LABEL[store.role]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {company.isCompanyOwner && (
                <div className="border-t px-4 py-2.5">
                  <Link
                    href={`/empresa/${company.companyId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Administrar a empresa (lojas, equipe, painel)
                  </Link>
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
