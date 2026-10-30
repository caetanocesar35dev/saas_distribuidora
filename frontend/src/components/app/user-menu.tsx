"use client";

import {
  CircleHelpIcon,
  GiftIcon,
  LogOutIcon,
  MonitorOffIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganizations } from "@/lib/api/hooks/admin";
import { useLogout, useLogoutAll } from "@/lib/session/actions";
import { useMe } from "@/lib/session/queries";

function initials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

export function UserMenu() {
  const me = useMe();
  const organizations = useOrganizations();
  const logout = useLogout();
  const logoutAll = useLogoutAll();
  const [confirmAll, setConfirmAll] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Menu do usuário" />}
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(me.data?.name)}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col">
            <span className="truncate font-medium text-foreground">{me.data?.name ?? "..."}</span>
            <span className="truncate text-xs font-normal">{me.data?.email}</span>
          </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/conta" />}>
            <UserIcon /> Minha conta
          </DropdownMenuItem>
          {/* O código de indicação é do responsável pela assinatura (quem recebe o desconto). */}
          {organizations.data?.some((o) => o.isBillingOwner) && (
            <DropdownMenuItem render={<Link href="/indique" />}>
              <GiftIcon /> Indique e ganhe
            </DropdownMenuItem>
          )}
          {me.data?.platformRole && (
            <DropdownMenuItem render={<Link href="/plataforma/organizacoes" />}>
              <ShieldCheckIcon /> Área da plataforma
            </DropdownMenuItem>
          )}
          <DropdownMenuItem render={<Link href="/duvidas" />}>
            <CircleHelpIcon /> Dúvidas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout.mutate()}>
            <LogOutIcon /> Sair
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmAll(true)}>
            <MonitorOffIcon /> Sair de todos os aparelhos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sair de todos os aparelhos?"
        description="Você será desconectado deste e de todos os outros aparelhos onde entrou. Será preciso entrar de novo."
        confirmLabel="Sair de todos"
        destructive
        pending={logoutAll.isPending}
        onConfirm={() => logoutAll.mutate()}
      />
    </>
  );
}
