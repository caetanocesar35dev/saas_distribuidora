"use client";

import { createContext, useContext } from "react";
import { LinkButton } from "@/components/app/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlatformRole } from "@/lib/api/types";
import { useMe } from "./queries";

interface PlatformAccess {
  role: PlatformRole;
  /** SUPERADMIN lê e escreve; SUPPORT só lê. */
  canWrite: boolean;
}

const PlatformContext = createContext<PlatformAccess | null>(null);

/** Só entra na área da plataforma quem tem `platformRole` (o backend também confere em cada rota). */
export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const me = useMe();

  if (me.isPending) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const role = me.data?.platformRole;
  if (!role) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <h1 className="text-xl font-semibold">Área restrita</h1>
        <p className="text-sm text-muted-foreground">
          Esta área é só para a equipe da plataforma. Volte para a sua loja.
        </p>
        <LinkButton href="/selecionar?trocar=1">Escolher loja</LinkButton>
      </div>
    );
  }

  return (
    <PlatformContext.Provider value={{ role, canWrite: role === "SUPERADMIN" }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformAccess {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform precisa estar dentro de /plataforma.");
  return ctx;
}
