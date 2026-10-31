"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { LinkButton } from "@/components/app/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/client";
import type {
  Membership,
  MembershipStoreView,
  ReadOnlyReason,
  Role,
  SubscriptionAccess,
} from "@/lib/api/types";
import { hasMinRole } from "@/lib/format";
import { READ_ONLY_MESSAGE } from "@/lib/subscription";
import { saveLastSelection } from "./last-selection";
import { useMemberships } from "./queries";

/** O que as telas precisam saber para decidir o que mostrar e o que habilitar. */
export interface Access {
  companyId: string;
  /** Papel na loja ativa; em telas de empresa, o maior papel do usuário nela. */
  role: Role | null;
  isCompanyOwner: boolean;
  isGeneralManager: boolean;
  /** Dono ou gerente geral: painel da empresa, equipe e lojas. */
  isCompanyAdmin: boolean;
  isBillingOwner: boolean;
  /** Assinatura vencida: só consulta (exceto fechar o caixa). */
  readOnly: boolean;
  readOnlyReason: ReadOnlyReason | null;
  readOnlyMessage: string | null;
  subscription: SubscriptionAccess;
}

export interface StoreScope extends Access {
  companyId: string;
  companyName: string;
  organizationId: string;
  storeId: string;
  storeName: string;
  /** Lojas da mesma empresa a que o usuário tem acesso. */
  stores: MembershipStoreView[];
}

export interface CompanyScope extends Access {
  companyId: string;
  companyName: string;
  organizationId: string;
  stores: MembershipStoreView[];
}

const AccessContext = createContext<Access | null>(null);
const StoreContext = createContext<StoreScope | null>(null);
const CompanyContext = createContext<CompanyScope | null>(null);

function accessOf(
  membership: Membership,
  role: Role | null,
): Access {
  const sub = membership.subscription;
  const readOnly = sub.accessMode === "READ_ONLY";
  return {
    companyId: membership.companyId,
    role,
    isCompanyOwner: membership.isCompanyOwner,
    isGeneralManager: membership.isGeneralManager,
    isCompanyAdmin: membership.isCompanyOwner || membership.isGeneralManager,
    isBillingOwner: membership.isBillingOwner,
    readOnly,
    readOnlyReason: sub.reason,
    readOnlyMessage: readOnly ? READ_ONLY_MESSAGE[sub.reason ?? "CANCELED"] : null,
    subscription: sub,
  };
}

function highestRole(stores: MembershipStoreView[]): Role | null {
  if (stores.some((s) => s.role === "OWNER")) return "OWNER";
  if (stores.some((s) => s.role === "MANAGER")) return "MANAGER";
  return stores.length > 0 ? "EMPLOYEE" : null;
}

function ScopeLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function NoAccess({ title, error }: { title: string; error?: unknown }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {error
          ? errorMessage(error)
          : "Seu acesso pode ter sido alterado. Escolha outra loja para continuar."}
      </p>
      <LinkButton href="/selecionar?trocar=1">Escolher loja</LinkButton>
    </div>
  );
}

export function StoreProvider({
  storeId,
  children,
}: {
  storeId: string;
  children: React.ReactNode;
}) {
  const { data, isPending, error } = useMemberships();

  const scope = useMemo<StoreScope | null>(() => {
    if (!data) return null;
    for (const membership of data) {
      const store = membership.stores.find((s) => s.storeId === storeId);
      if (store) {
        return {
          ...accessOf(membership, store.role),
          companyId: membership.companyId,
          companyName: membership.companyName,
          organizationId: membership.organizationId,
          storeId,
          storeName: store.storeName,
          stores: membership.stores,
        };
      }
    }
    return null;
  }, [data, storeId]);

  useEffect(() => {
    if (scope) saveLastSelection({ companyId: scope.companyId, storeId });
  }, [scope, storeId]);

  if (isPending) return <ScopeLoading />;
  if (error) return <NoAccess title="Não foi possível carregar seu acesso" error={error} />;
  if (!scope) return <NoAccess title="Você não tem acesso a esta loja" />;

  return (
    <AccessContext.Provider value={scope}>
      <StoreContext.Provider value={scope}>{children}</StoreContext.Provider>
    </AccessContext.Provider>
  );
}

export function CompanyProvider({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  const { data, isPending, error } = useMemberships();

  const scope = useMemo<CompanyScope | null>(() => {
    const membership = data?.find((m) => m.companyId === companyId);
    if (!membership) return null;
    return {
      ...accessOf(membership, highestRole(membership.stores)),
      companyId,
      companyName: membership.companyName,
      organizationId: membership.organizationId,
      stores: membership.stores,
    };
  }, [data, companyId]);

  if (isPending) return <ScopeLoading />;
  if (error) return <NoAccess title="Não foi possível carregar seu acesso" error={error} />;
  if (!scope) return <NoAccess title="Você não tem acesso a esta empresa" />;

  return (
    <AccessContext.Provider value={scope}>
      <CompanyContext.Provider value={scope}>{children}</CompanyContext.Provider>
    </AccessContext.Provider>
  );
}

/** Dados da loja ativa (só dentro de `/loja/[storeId]`). */
export function useStore(): StoreScope {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de /loja/[storeId].");
  return ctx;
}

/** Dados da empresa ativa (só dentro de `/empresa/[companyId]`). */
export function useCompany(): CompanyScope {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompany precisa estar dentro de /empresa/[companyId].");
  }
  return ctx;
}

/** Papel e estado da assinatura, em qualquer das duas áreas. */
export function useAccess(): Access {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess precisa estar dentro de uma loja ou empresa.");
  return ctx;
}

/** Papel do usuário na loja ativa, lido dos memberships (sem chamar a API). */
export function useCurrentRole(): Role | null {
  return useAccess().role;
}

export function useHasRole(min: Role): boolean {
  return hasMinRole(useAccess().role, min);
}
