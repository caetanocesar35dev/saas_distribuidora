"use client";

import { MailPlusIcon, Trash2Icon, UserMinusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import {
  ActionButton,
  RequireCompanyOwner,
  RequireCompanyOwnerPage,
} from "@/components/app/guards";
import { HistoryButton } from "@/components/app/history-dialog";
import { PersonNameInput, SelectField, type Option } from "@/components/app/inputs";
import { Badge } from "@/components/ui/badge";
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
  useInviteMember,
  useMembers,
  useRemoveMember,
  useRevokeMemberStore,
  useSetMemberRole,
} from "@/lib/api/hooks/admin";
import type { Member, Role } from "@/lib/api/types";
import { isValidPersonName, ROLE_LABEL } from "@/lib/format";
import { useCompany } from "@/lib/session/context";
import { useMe } from "@/lib/session/queries";

const ROLE_OPTIONS: Option<Role>[] = [
  { value: "EMPLOYEE", label: ROLE_LABEL.EMPLOYEE },
  { value: "MANAGER", label: ROLE_LABEL.MANAGER },
  { value: "OWNER", label: ROLE_LABEL.OWNER },
];

const ROLE_HELP: Record<Role, string> = {
  EMPLOYEE: "Vende, abre e fecha o caixa, atende comandas e clientes.",
  MANAGER: "Tudo do atendente, mais estoque, preços, sangria e cancelar vendas.",
  OWNER: "Tudo da loja, mais equipe, lojas e painéis da empresa.",
};

// ---- Convite ---------------------------------------------------------------------------------

function InviteDialog({
  companyId,
  open,
  onOpenChange,
}: {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { stores } = useCompany();
  const invite = useInviteMember(companyId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Record<string, Role>>({});

  function close() {
    onOpenChange(false);
    setName("");
    setEmail("");
    setSelected({});
  }

  const chosen = Object.entries(selected);
  const valid = isValidPersonName(name) && /\S+@\S+\.\S+/.test(email) && chosen.length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar pessoa</DialogTitle>
          <DialogDescription>
            Enviamos um e-mail para a pessoa criar a senha. O convite vale por 7 dias. Quem já tem
            conta só ganha o acesso.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate(
              {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                stores: chosen.map(([storeId, role]) => ({ storeId, role })),
              },
              {
                onSuccess: (result) => {
                  toast.success(
                    result.invitedNewUser
                      ? "Convite enviado por e-mail."
                      : "Acesso liberado. A pessoa já pode entrar com a conta que tem.",
                  );
                  close();
                },
              },
            );
          }}
        >
          <FormField label="Nome" htmlFor="invite-name">
            <PersonNameInput
              id="invite-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="E-mail" htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Em quais lojas e com qual papel?</legend>
            {stores.map((store) => {
              const role = selected[store.storeId];
              return (
                <div
                  key={store.storeId}
                  className="flex items-center gap-3 rounded-lg border p-2.5"
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={role !== undefined}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => {
                          const next = { ...prev };
                          if (checked) next[store.storeId] = "EMPLOYEE";
                          else delete next[store.storeId];
                          return next;
                        })
                      }
                    />
                    {store.storeName}
                  </label>
                  {role && (
                    <SelectField
                      value={role}
                      options={ROLE_OPTIONS}
                      className="w-36"
                      size="sm"
                      onChange={(value) =>
                        setSelected((prev) => ({ ...prev, [store.storeId]: value }))
                      }
                    />
                  )}
                </div>
              );
            })}
            <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
              {ROLE_OPTIONS.map((o) => (
                <li key={o.value}>
                  <strong>{o.label}:</strong> {ROLE_HELP[o.value]}
                </li>
              ))}
            </ul>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || invite.isPending}>
              {invite.isPending ? "Enviando..." : "Enviar convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Membro ----------------------------------------------------------------------------------

function MemberCard({
  member,
  companyId,
  isSelf,
}: {
  member: Member;
  companyId: string;
  isSelf: boolean;
}) {
  const { stores: allStores } = useCompany();
  const setRole = useSetMemberRole(companyId);
  const revoke = useRevokeMemberStore(companyId);
  const remove = useRemoveMember(companyId);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [revoking, setRevoking] = useState<{ storeId: string; storeName: string } | null>(null);

  const missing = allStores.filter((s) => !member.stores.some((ms) => ms.storeId === s.storeId));

  return (
    <article className="rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {member.user.name}
            {isSelf && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
            {!member.user.isActive && (
              <Badge variant="destructive" className="ml-2">
                Conta desativada
              </Badge>
            )}
          </p>
          <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
        </div>
        {!isSelf && (
          <ActionButton variant="destructive" size="sm" onClick={() => setConfirmRemove(true)}>
            <UserMinusIcon /> Remover da empresa
          </ActionButton>
        )}
      </header>

      <ul className="mt-3 divide-y rounded-lg border">
        {member.stores.map((s) => (
          <li key={s.storeId} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1 text-sm font-medium">{s.storeName}</span>
            <SelectField
              value={s.role}
              options={ROLE_OPTIONS}
              size="sm"
              className="w-36"
              disabled={isSelf || setRole.isPending}
              onChange={(role) =>
                setRole.mutate(
                  { membershipId: member.membershipId, storeId: s.storeId, role },
                  { onSuccess: () => toast.success("Papel atualizado.") },
                )
              }
            />
            <HistoryButton
              size="xs"
              target={{
                scope: "company",
                scopeId: companyId,
                entity: "membership-stores",
                id: `${member.membershipId}:${s.storeId}`,
              }}
              title={`Histórico de ${member.user.name} em ${s.storeName}`}
            />
            {!isSelf && (
              <ActionButton
                variant="ghost"
                size="icon-sm"
                aria-label={`Revogar acesso a ${s.storeName}`}
                title="Revogar acesso a esta loja"
                onClick={() => setRevoking({ storeId: s.storeId, storeName: s.storeName })}
              >
                <Trash2Icon />
              </ActionButton>
            )}
          </li>
        ))}
      </ul>

      {!isSelf && missing.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Dar acesso também a:</span>
          {missing.map((s) => (
            <ActionButton
              key={s.storeId}
              variant="outline"
              size="xs"
              disabled={setRole.isPending}
              onClick={() =>
                setRole.mutate(
                  { membershipId: member.membershipId, storeId: s.storeId, role: "EMPLOYEE" },
                  {
                    onSuccess: () =>
                      toast.success(`Acesso a ${s.storeName} liberado como atendente.`),
                  },
                )
              }
            >
              {s.storeName}
            </ActionButton>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Revogar o acesso de ${member.user.name}?`}
        description={`${member.user.name} deixa de acessar a loja ${revoking?.storeName ?? ""}. Se for a última loja, ela sai da equipe da empresa.`}
        confirmLabel="Revogar acesso"
        destructive
        pending={revoke.isPending}
        onConfirm={() =>
          revoking &&
          revoke.mutate(
            { membershipId: member.membershipId, storeId: revoking.storeId },
            {
              onSuccess: () => {
                toast.success("Acesso revogado.");
                setRevoking(null);
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remover ${member.user.name} da empresa?`}
        description="A pessoa perde o acesso a todas as lojas da empresa. A conta dela continua existindo e o histórico das vendas e ações dela é mantido."
        confirmLabel="Remover da empresa"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(member.membershipId, {
            onSuccess: () => {
              toast.success("Membro removido.");
              setConfirmRemove(false);
            },
          })
        }
      />
    </article>
  );
}

function TeamList({ companyId }: { companyId: string }) {
  const members = useMembers(companyId);
  const me = useMe();

  return (
    <QueryBoundary query={members}>
      {(list) =>
        list.length === 0 ? (
          <EmptyState title="Nenhum membro na equipe" />
        ) : (
          <div className="space-y-3">
            {list.map((member) => (
              <MemberCard
                key={member.membershipId}
                member={member}
                companyId={companyId}
                isSelf={member.user.id === me.data?.id}
              />
            ))}
          </div>
        )
      }
    </QueryBoundary>
  );
}

export function TeamView() {
  const { companyId } = useCompany();
  const [inviting, setInviting] = useState(false);

  return (
    <div>
      <PageHeader
        title="Equipe"
        description="Quem trabalha na empresa e com qual papel em cada loja. O papel pode ser diferente em cada loja."
        help="gestao-equipe"
        actions={
          <RequireCompanyOwner>
            <ActionButton onClick={() => setInviting(true)}>
              <MailPlusIcon /> Convidar pessoa
            </ActionButton>
          </RequireCompanyOwner>
        }
      />
      <RequireCompanyOwnerPage>
        <TeamList companyId={companyId} />
        <InviteDialog companyId={companyId} open={inviting} onOpenChange={setInviting} />
      </RequireCompanyOwnerPage>
    </div>
  );
}
