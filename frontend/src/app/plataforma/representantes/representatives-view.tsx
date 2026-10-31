"use client";

import { PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState, Money, PageHeader, QueryBoundary } from "@/components/app/common";
import { FormField } from "@/components/app/form";
import { PlatformActionButton } from "@/components/app/platform-button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteRepresentative,
  useRepresentatives,
  useRestoreRepresentative,
  useSaveRepresentative,
} from "@/lib/api/hooks/referrals";
import type { SalesRepresentative } from "@/lib/api/types";
import { formatDateTime, formatPhone, isValidPhone, maskPhone, onlyDigits } from "@/lib/format";
import { normalizeReferralCode } from "@/lib/referral";

/** Comissão padrão sugerida: % do preço mensal do plano que o indicado assinar. */
const DEFAULT_COMMISSION = 50;

function RepresentativeDialog({
  rep,
  onClose,
}: {
  rep: SalesRepresentative | null;
  onClose: () => void;
}) {
  const save = useSaveRepresentative();
  const [name, setName] = useState(rep?.name ?? "");
  const [phone, setPhone] = useState(rep ? maskPhone(rep.phone) : "");
  const [email, setEmail] = useState(rep?.email ?? "");
  const [pixKey, setPixKey] = useState(rep?.pixKey ?? "");
  const [code, setCode] = useState(rep?.code ?? "");
  const [percent, setPercent] = useState(String(rep?.commissionPercent ?? DEFAULT_COMMISSION));
  const [notes, setNotes] = useState(rep?.notes ?? "");

  const percentValue = Number(percent.replace(",", "."));
  const valid =
    name.trim() !== "" &&
    isValidPhone(phone) &&
    pixKey.trim() !== "" &&
    percent.trim() !== "" &&
    percentValue >= 0 &&
    percentValue <= 100;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rep ? "Editar representante" : "Novo representante"}</DialogTitle>
          <DialogDescription>
            Quem indica o sistema sem usá-lo. Ele não tem login: você paga a comissão por Pix
            quando o indicado paga a primeira mensalidade.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            save.mutate(
              {
                id: rep?.id,
                body: {
                  name: name.trim(),
                  phone: onlyDigits(phone),
                  email: email.trim() || null,
                  pixKey: pixKey.trim(),
                  // Sem código, o sistema cria um a partir do nome.
                  ...(code.trim() ? { code: normalizeReferralCode(code) } : {}),
                  commissionPercent: percentValue,
                  notes: notes.trim() || null,
                },
              },
              {
                onSuccess: (saved) => {
                  toast.success(
                    rep ? "Representante atualizado." : `Representante criado com o código ${saved.code}.`,
                  );
                  onClose();
                },
              },
            );
          }}
        >
          <FormField label="Nome" htmlFor="rep-name">
            <Input
              id="rep-name"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Telefone (WhatsApp)" htmlFor="rep-phone">
              <Input
                id="rep-phone"
                type="tel"
                inputMode="tel"
                placeholder="(81) 99999-0000"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
              />
            </FormField>
            <FormField label="E-mail (opcional)" htmlFor="rep-email">
              <Input
                id="rep-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Chave Pix" htmlFor="rep-pix" hint="CPF, e-mail, celular ou chave aleatória.">
            <Input
              id="rep-pix"
              maxLength={140}
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Código de indicação"
              htmlFor="rep-code"
              hint={rep ? "Mudar não afeta quem já se cadastrou." : "Vazio = o sistema cria um."}
            >
              <Input
                id="rep-code"
                maxLength={20}
                autoCapitalize="characters"
                placeholder="Ex.: JOAO-REP"
                value={code}
                onChange={(e) => setCode(normalizeReferralCode(e.target.value))}
              />
            </FormField>
            <FormField
              label="Comissão (% do plano)"
              htmlFor="rep-percent"
              hint="Da 1ª mensalidade do plano que o indicado assinar."
            >
              <Input
                id="rep-percent"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.5"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Observações (opcional)" htmlFor="rep-notes">
            <Textarea
              id="rep-notes"
              maxLength={500}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Representantes excluídos: o código deixa de valer no cadastro; dá para reativar. */
function DeletedRepresentatives() {
  const [open, setOpen] = useState(false);
  const deleted = useRepresentatives(true, open);
  const restore = useRestoreRepresentative();

  return (
    <section className="mt-6 space-y-3">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={open} onCheckedChange={setOpen} />
        Mostrar os representantes excluídos
      </label>
      {open && (
        <QueryBoundary query={deleted}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState title="Nenhum representante excluído" />
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Representante</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Indicações</TableHead>
                      <TableHead className="text-right">A pagar</TableHead>
                      <TableHead>Excluído em</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((rep) => (
                      <TableRow key={rep.id}>
                        <TableCell className="font-medium">{rep.name}</TableCell>
                        <TableCell className="font-mono">{rep.code}</TableCell>
                        <TableCell className="text-right tabular-nums">{rep.referrals}</TableCell>
                        <TableCell className="text-right">
                          <Money value={rep.toPayInCents / 100} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {rep.deletedAt ? formatDateTime(rep.deletedAt) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <PlatformActionButton
                              variant="outline"
                              size="sm"
                              disabled={restore.isPending}
                              onClick={() =>
                                restore.mutate(rep.id, {
                                  onSuccess: (r) =>
                                    toast.success(`O código ${r.code} voltou a valer.`),
                                })
                              }
                            >
                              <RotateCcwIcon /> Reativar
                            </PlatformActionButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          }
        </QueryBoundary>
      )}
    </section>
  );
}

export function RepresentativesView() {
  const reps = useRepresentatives();
  const remove = useDeleteRepresentative();
  const [dialog, setDialog] = useState<{ rep: SalesRepresentative | null } | null>(null);
  const [deleting, setDeleting] = useState<SalesRepresentative | null>(null);

  return (
    <div>
      <PageHeader
        title="Representantes"
        description="Quem indica o sistema sem usá-lo, com o contato e a chave Pix para pagar a comissão."
        help="plataforma-indicacoes"
        actions={
          <PlatformActionButton onClick={() => setDialog({ rep: null })}>
            <PlusIcon /> Novo representante
          </PlatformActionButton>
        }
      />
      <QueryBoundary query={reps}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title="Nenhum representante cadastrado"
              description="Cadastre quem vai indicar o sistema: cada um ganha um código para passar aos interessados."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Representante</TableHead>
                    <TableHead>Chave Pix</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Indicações</TableHead>
                    <TableHead className="text-right">A pagar</TableHead>
                    <TableHead className="text-right">Já pago</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((rep) => (
                    <TableRow key={rep.id}>
                      <TableCell>
                        <p className="font-medium">{rep.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPhone(rep.phone)}
                          {rep.email ? ` · ${rep.email}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-48 truncate" title={rep.pixKey}>
                        {rep.pixKey}
                      </TableCell>
                      <TableCell className="font-mono">{rep.code}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rep.commissionPercent}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Link
                          href={`/plataforma/indicacoes?representante=${rep.id}`}
                          className="text-primary hover:underline"
                        >
                          {rep.confirmed} de {rep.referrals}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <Money value={rep.toPayInCents / 100} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={rep.paidInCents / 100} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <PlatformActionButton
                            variant="outline"
                            size="sm"
                            onClick={() => setDialog({ rep })}
                          >
                            <PencilIcon /> Editar
                          </PlatformActionButton>
                          <PlatformActionButton
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir ${rep.name}`}
                            onClick={() => setDeleting(rep)}
                          >
                            <Trash2Icon />
                          </PlatformActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        }
      </QueryBoundary>
      <p className="mt-2 text-xs text-muted-foreground">
        Indicações: confirmadas (o indicado já pagou) de cadastradas. A comissão de cada indicação
        se marca como paga em Indicações.
      </p>
      <DeletedRepresentatives />

      {dialog && (
        <RepresentativeDialog
          key={dialog.rep?.id ?? "new"}
          rep={dialog.rep}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir ${deleting?.name ?? ""}?`}
        description="O código dele deixa de valer no cadastro. As indicações e comissões continuam em Indicações, e dá para reativar em Mostrar os representantes excluídos."
        confirmLabel="Excluir representante"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Representante excluído.");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
