"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useVotePoll } from "@/lib/api/hooks/notifications";
import type { Poll } from "@/lib/api/types";
import { formatDateTime, formatInt } from "@/lib/format";
import { pollPercent, sameSelection, toggleOption } from "@/lib/poll";
import { cn } from "@/lib/utils";

/** "Vote até ..." ou "Votação encerrada em ...", e se aceita uma ou várias respostas. */
export function PollDeadline({ poll }: { poll: Poll }) {
  return (
    <p className="text-xs text-muted-foreground">
      {poll.closed
        ? `Votação encerrada em ${formatDateTime(poll.endsAt)}`
        : `Vote até ${formatDateTime(poll.endsAt)}`}
      {" · "}
      {poll.multiple ? "Pode escolher mais de uma opção" : "Escolha uma opção"}
    </p>
  );
}

/** Resultado em barras: votos e porcentagem de cada opção, com a marca do que a pessoa escolheu. */
export function PollResults({ poll }: { poll: Poll }) {
  return (
    <div className="space-y-2">
      <ul className="space-y-2" aria-label="Resultado da enquete">
        {poll.options.map((option) => {
          const percent = pollPercent(option.votes, poll.totalVoters) ?? 0;
          const mine = poll.myOptionIds.includes(option.id);
          return (
            <li key={option.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className={cn("flex min-w-0 items-center gap-1.5", mine && "font-medium")}>
                  {mine && <CheckIcon className="size-4 shrink-0 text-primary" aria-label="Seu voto" />}
                  <span className="truncate">{option.label}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatInt(option.votes ?? 0)} {option.votes === 1 ? "voto" : "votos"} · {percent}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", mine ? "bg-primary" : "bg-primary/40")}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {poll.totalVoters === 1 ? "1 pessoa votou" : `${formatInt(poll.totalVoters ?? 0)} pessoas votaram`}
      </p>
    </div>
  );
}

/**
 * Enquete para quem recebe a notificação: vota, vê o resultado e pode mudar o voto até o prazo.
 * Quem não votou só vê os números depois do prazo (regra do backend).
 */
export function PollVote({ notificationId, poll }: { notificationId: string; poll: Poll }) {
  const vote = useVotePoll();
  const voted = poll.myOptionIds.length > 0;
  const [changing, setChanging] = useState(false);
  const [selected, setSelected] = useState<string[]>(poll.myOptionIds);
  const choosing = !poll.closed && (!voted || changing);

  if (!choosing) {
    return (
      <div className="space-y-2">
        <PollDeadline poll={poll} />
        {poll.showResults && <PollResults poll={poll} />}
        {!poll.closed && voted && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelected(poll.myOptionIds);
              setChanging(true);
            }}
          >
            Mudar voto
          </Button>
        )}
      </div>
    );
  }

  const inputType = poll.multiple ? "checkbox" : "radio";
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        vote.mutate(
          { id: notificationId, optionIds: selected },
          {
            onSuccess: () => {
              setChanging(false);
              toast.success(voted ? "Voto alterado." : "Voto registrado.");
            },
          },
        );
      }}
    >
      <PollDeadline poll={poll} />
      <fieldset className="space-y-1.5">
        <legend className="sr-only">Opções da enquete</legend>
        {poll.options.map((option) => (
          <label
            key={option.id}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50",
              selected.includes(option.id) && "border-primary bg-primary/5",
            )}
          >
            <input
              type={inputType}
              name={`poll-${notificationId}`}
              className="size-4 accent-primary"
              checked={selected.includes(option.id)}
              onChange={() => setSelected((s) => toggleOption(s, option.id, poll.multiple))}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={
            selected.length === 0 ||
            (voted && sameSelection(selected, poll.myOptionIds)) ||
            vote.isPending
          }
        >
          {vote.isPending ? "Enviando..." : voted ? "Salvar voto" : "Votar"}
        </Button>
        {changing && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setChanging(false)}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
