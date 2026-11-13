"use client";

import {
  MailPlusIcon,
  RotateCcwIcon,
  ShieldIcon,
  Trash2Icon,
  UserMinusIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import {
  ActionButton,
  RequireCompanyAdmin,
  RequireCompanyAdminPage,
  RequireCompanyOwner,
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
  useRemovedMembers,
  useRemoveMember,
  useRestoreMember,
  useRevokeMemberStore,
  useSetGeneralManager,
  useSetMemberRole,
} from "@/lib/api/hooks/admin";
import type { Member, Role } from "@/lib/api/types";
import { formatDateTime, isValidPersonName, ROLE_LABEL } from "@/lib/format";
import { useCompany } from "@/lib/session/context";
import { useMe } from "@/lib/session/queries";
import {
  allSelected,
  commonRole,
  type InviteSelection,
  selectAllStores,
  setRoleForAll,
} from "./invite-stores";

const ROLE_OPTIONS: Option<Role>[] = [
  { value: "EMPLOYEE", label: ROLE_LABEL.EMPLOYEE },
  { value: "MANAGER", label: ROLE_LABEL.MANAGER },
  { value: "OWNER", label: ROLE_LABEL.OWNER },
];
/** O gerente geral não dá o papel de dono. */
const NON_OWNER_OPTIONS = ROLE_OPTIONS.filter((o) => o.value !== "OWNER");

const ROLE_HELP: Record<Role, string> = {
  EMPLOYEE: "Vende, abre e fecha o caixa, atende comandas e clientes.",
  MANAGER: "Tudo do atendente, mais estoque, preços, sangria e cancelar vendas.",
  OWNER: "Tudo da loja, mais equipe, lojas e painéis da empresa.",
};

/** Aviso ao dar o papel de dono: não existe "dono só desta loja" (decisão do usuário, 2026-11-13). */
const OWNER_WARNING =
  "Dono em qualquer loja é dono da empresa inteira: vê o painel e o lucro de todas as lojas, edita os dados da empresa, cria e exclui lojas e mexe na equipe, inclusive em outros donos. Só não mexe na assinatura nem nos acessos do responsável por ela. Para dar autonomia sem isso, use Gerente ou Gerente geral.";

const BILLING_OWNER_HELP =
  "Quem criou a conta e responde pela assinatura. Os acessos dele só podem ser alterados por ele mesmo.";

const GENERAL_MANAGER_HELP =
  "Gerente em todas as lojas (também nas criadas depois), com o painel da empresa, a equipe (atendentes e gerentes) e a edição das lojas. Não mexe em donos, dados da empresa nem assinatura.";

/** Opções de papel para quem está usando a tela (o gerente geral não vê "Dono"). */
function useRoleOptions() {
  return useCompany().isCompanyOwner ? ROLE_OPTIONS : NON_OWNER_OPTIONS;
}

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
  const roleOptions = useRoleOptions();
  const invite = useInviteMember(companyId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<InviteSelection>({});
  const storeIds = stores.map((s) => s.storeId);
  const everyStore = allSelected(storeIds, selected);
  const sameRole = commonRole(selected);

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
                    result.passwordSetupSent
                      ? "Convite enviado por e-mail, com o link para a pessoa criar a senha."
                      : "Acesso liberado. A pessoa já tem conta e entra com a senha dela.",
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
            {stores.length > 1 && (
              <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/40 p-2.5">
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={everyStore}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => (checked ? selectAllStores(storeIds, prev) : {}))
                    }
                  />
                  Todas as lojas ({stores.length})
                </label>
                {everyStore && (
                  <SelectField
                    value={sameRole ?? undefined}
                    placeholder="Papéis diferentes"
                    aria-label="Papel em todas as lojas"
                    options={roleOptions}
                    className="w-36"
                    size="sm"
                    onChange={(value) => setSelected((prev) => setRoleForAll(prev, value))}
                  />
                )}
              </div>
            )}
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
                      options={roleOptions}
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
            {chosen.some(([, role]) => role === "OWNER") && (
              <p
                role="alert"
                className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <strong>Atenção:</strong> {OWNER_WARNING}
              </p>
            )}
            <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
              {roleOptions.map((o) => (
                <li key={o.value}>
                  <strong>{o.label}:</strong> {ROLE_HELP[o.value]}
                </li>
              ))}
              <li>
                <strong>Gerente geral:</strong> convide como gerente e depois, na lista da equipe, o
                dono marca &quot;Tornar gerente geral&quot;.
              </li>
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
  const { stores: allStores, isCompanyOwner: viewerIsOwner } = useCompany();
  const roleOptions = useRoleOptions();
  const setRole = useSetMemberRole(companyId);
  const revoke = useRevokeMemberStore(companyId);
  const remove = useRemoveMember(companyId);
  const setGeneralManager = useSetGeneralManager(companyId);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmGeneral, setConfirmGeneral] = useState(false);
  const [revoking, setRevoking] = useState<{ storeId: string; storeName: string } | null>(null);
  // Dar o papel de dono pede confirmação: a pessoa vira dona da empresa inteira.
  const [promoting, setPromoting] = useState<{ storeId: string; storeName: string } | null>(null);

  const missing = allStores.filter((s) => !member.stores.some((ms) => ms.storeId === s.storeId));
  const memberIsOwner = member.stores.some((s) => s.role === "OWNER");
  // O gerente geral não mexe em donos nem em outros gerentes gerais; ninguém mexe no responsável
  // pela assinatura (só ele mesmo).
  const outOfReach =
    (!viewerIsOwner && (memberIsOwner || member.isGeneralManager)) || !!member.isBillingOwner;
  const canEdit = !isSelf && !outOfReach;
  // O papel do gerente geral nas lojas fica fixo (gerente) até desmarcá-lo.
  const canEditStores = canEdit && !member.isGeneralManager;

  return (
    <article className="rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {member.user.name}
            {isSelf && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
            {member.isGeneralManager && (
              <Badge className="ml-2" title={GENERAL_MANAGER_HELP}>
                Gerente geral
              </Badge>
            )}
            {member.isBillingOwner && (
              <Badge variant="secondary" className="ml-2" title={BILLING_OWNER_HELP}>
                Responsável pela assinatura
              </Badge>
            )}
            {!member.user.isActive && (
              <Badge variant="destructive" className="ml-2">
                Conta desativada
              </Badge>
            )}
          </p>
          <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
        </div>
        {viewerIsOwner && !isSelf && !memberIsOwner && !member.isBillingOwner && (
          <ActionButton variant="outline" size="sm" onClick={() => setConfirmGeneral(true)}>
            <ShieldIcon />
            {member.isGeneralManager ? "Tirar de gerente geral" : "Tornar gerente geral"}
          </ActionButton>
        )}
        {canEdit && (
          <ActionButton variant="destructive" size="sm" onClick={() => setConfirmRemove(true)}>
            <UserMinusIcon /> Remover da empresa
          </ActionButton>
        )}
      </header>
      {member.isGeneralManager && (
        <p className="mt-2 text-xs text-muted-foreground">{GENERAL_MANAGER_HELP}</p>
      )}
      {member.isBillingOwner && !isSelf && (
        <p className="mt-2 text-xs text-muted-foreground">{BILLING_OWNER_HELP}</p>
      )}

      <ul className="mt-3 divide-y rounded-lg border">
        {member.stores.map((s) => (
          <li key={s.storeId} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1 text-sm font-medium">{s.storeName}</span>
            <SelectField
              value={s.role}
              options={canEditStores ? roleOptions : ROLE_OPTIONS}
              size="sm"
              className="w-36"
              disabled={!canEditStores || setRole.isPending}
              onChange={(role) => {
                if (role === "OWNER" && s.role !== "OWNER") {
                  setPromoting({ storeId: s.storeId, storeName: s.storeName });
                  return;
                }
                setRole.mutate(
                  { membershipId: member.membershipId, storeId: s.storeId, role },
                  { onSuccess: () => toast.success("Papel atualizado.") },
                );
              }}
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
            {canEditStores && (
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

      {canEditStores && missing.length > 0 && (
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
        open={promoting !== null}
        onOpenChange={(open) => !open && setPromoting(null)}
        title={`Tornar ${member.user.name} dono da empresa?`}
        description={`Você escolheu Dono em ${promoting?.storeName ?? ""}. ${OWNER_WARNING}`}
        confirmLabel="Sim, tornar dono"
        destructive
        pending={setRole.isPending}
        onConfirm={() =>
          promoting &&
          setRole.mutate(
            { membershipId: member.membershipId, storeId: promoting.storeId, role: "OWNER" },
            {
              onSuccess: () => {
                toast.success(`${member.user.name} agora é dono da empresa.`);
                setPromoting(null);
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={confirmGeneral}
        onOpenChange={setConfirmGeneral}
        title={
          member.isGeneralManager
            ? `Tirar ${member.user.name} de gerente geral?`
            : `Tornar ${member.user.name} gerente geral?`
        }
        description={
          member.isGeneralManager
            ? "A pessoa perde o painel da empresa, a equipe e a edição das lojas, mas continua como gerente nas lojas. Depois você pode ajustar o papel em cada loja."
            : `${GENERAL_MANAGER_HELP} Onde a pessoa é atendente, ela passa a ser gerente.`
        }
        confirmLabel={member.isGeneralManager ? "Tirar de gerente geral" : "Tornar gerente geral"}
        pending={setGeneralManager.isPending}
        onConfirm={() =>
          setGeneralManager.mutate(
            { membershipId: member.membershipId, isGeneralManager: !member.isGeneralManager },
            {
              onSuccess: (result) => {
                toast.success(result.message);
                setConfirmGeneral(false);
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remover ${member.user.name} da empresa?`}
        description="A pessoa perde o acesso a todas as lojas da empresa. A conta dela continua existindo, o histórico das vendas e ações dela é mantido, e dá para reativá-la (com os mesmos acessos) em Mostrar quem foi removido."
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

/** Pessoas removidas da empresa, com as lojas e os papéis que tinham, para o dono reativar. */
function RemovedMembers({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const removed = useRemovedMembers(companyId, open);
  const restore = useRestoreMember(companyId);

  return (
    <section className="mt-6 space-y-3">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={open} onCheckedChange={setOpen} />
        Mostrar quem foi removido
      </label>
      {open && (
        <QueryBoundary query={removed}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState
                title="Ninguém removido"
                description="Quem você remover da empresa aparece aqui para reativar."
              />
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {list.map((member) => (
                  <li
                    key={member.membershipId}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {member.user.name}
                        <Badge variant="secondary" className="ml-2">
                          Removido em {formatDateTime(member.removedAt)}
                        </Badge>
                        {!member.user.isActive && (
                          <Badge variant="destructive" className="ml-2">
                            Conta desativada
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.stores.length > 0
                          ? `Tinha acesso a: ${member.stores
                              .map((s) => `${s.storeName} (${ROLE_LABEL[s.role]})`)
                              .join(", ")}`
                          : "As lojas que acessava foram excluídas: para voltar, convide de novo."}
                      </p>
                    </div>
                    {member.stores.length > 0 && (
                      <ActionButton
                        variant="outline"
                        size="sm"
                        disabled={restore.isPending}
                        onClick={() =>
                          restore.mutate(member.membershipId, {
                            onSuccess: () =>
                              toast.success(
                                `${member.user.name} voltou para a equipe, com os mesmos acessos de antes.`,
                              ),
                          })
                        }
                      >
                        <RotateCcwIcon /> Reativar
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )
          }
        </QueryBoundary>
      )}
    </section>
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
          <RequireCompanyAdmin>
            <ActionButton onClick={() => setInviting(true)}>
              <MailPlusIcon /> Convidar pessoa
            </ActionButton>
          </RequireCompanyAdmin>
        }
      />
      <RequireCompanyAdminPage>
        <TeamList companyId={companyId} />
        {/* Ver e reativar quem foi removido é só do dono. */}
        <RequireCompanyOwner>
          <RemovedMembers companyId={companyId} />
        </RequireCompanyOwner>
        <InviteDialog companyId={companyId} open={inviting} onOpenChange={setInviting} />
      </RequireCompanyAdminPage>
    </div>
  );
}
