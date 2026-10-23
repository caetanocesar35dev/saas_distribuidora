"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app/common";
import { SelectField } from "@/components/app/inputs";
import { Pagination } from "@/components/app/pagination";
import { PlatformActionButton } from "@/components/app/platform-button";
import { Badge } from "@/components/ui/badge";
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
import { usePlatformUsers, useSetUserActive } from "@/lib/api/hooks/platform";
import type { PlatformUser } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

type ActiveFilter = "all" | "active" | "inactive";

export function UsersView() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<ActiveFilter>("all");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  const [toggling, setToggling] = useState<PlatformUser | null>(null);
  const setUserActive = useSetUserActive();

  const list = usePlatformUsers({
    page,
    limit: 20,
    search: debounced.trim() || undefined,
    isActive: active === "all" ? undefined : active === "active",
  });

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Todas as contas do sistema. Desativar uma conta encerra as sessões dela em todas as empresas."
        help="plataforma-usuarios"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nome ou e-mail"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Buscar usuários"
          />
        </div>
        <SelectField<ActiveFilter>
          className="w-44"
          value={active}
          onChange={(v) => {
            setActive(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Todos" },
            { value: "active", label: "Ativos" },
            { value: "inactive", label: "Desativados" },
          ]}
        />
      </div>

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado" />
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel na plataforma</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {user.platformRole === "SUPERADMIN"
                        ? "Administrador"
                        : user.platformRole === "SUPPORT"
                          ? "Suporte"
                          : "—"}
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge variant="secondary">Ativo</Badge>
                      ) : (
                        <Badge variant="destructive">Desativado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <PlatformActionButton
                        variant="outline"
                        size="sm"
                        onClick={() => setToggling(user)}
                      >
                        {user.isActive ? "Desativar" : "Ativar"}
                      </PlatformActionButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => !open && setToggling(null)}
        title={`${toggling?.isActive ? "Desativar" : "Ativar"} ${toggling?.name ?? "o usuário"}?`}
        description={
          toggling?.isActive
            ? "A pessoa deixa de conseguir entrar e as sessões dela são encerradas agora, em todas as empresas."
            : "A pessoa volta a poder entrar com o e-mail e a senha dela."
        }
        confirmLabel={toggling?.isActive ? "Desativar" : "Ativar"}
        destructive={toggling?.isActive}
        pending={setUserActive.isPending}
        onConfirm={() =>
          toggling &&
          setUserActive.mutate(
            { id: toggling.id, isActive: !toggling.isActive },
            {
              onSuccess: () => {
                toast.success(toggling.isActive ? "Usuário desativado." : "Usuário ativado.");
                setToggling(null);
              },
            },
          )
        }
      />
    </div>
  );
}
