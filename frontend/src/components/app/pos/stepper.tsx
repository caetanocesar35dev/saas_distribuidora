"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Contador − [n] + de uma linha do carrinho ou da comanda (unidades ou embalagens). */
export function Stepper({
  label,
  name,
  value,
  min,
  max = Number.MAX_SAFE_INTEGER,
  disabled = false,
  onChange,
}: {
  label?: string;
  name: string;
  value: number;
  min: number;
  /** Sem `max`, quem confere o estoque é o backend. */
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  // Passar do estoque (pelo "+" ou digitando) avisa "Estoque insuficiente" e fica no máximo.
  const set = (n: number) => {
    const top = Math.max(max, min);
    if (n > top) toast.error("Estoque insuficiente");
    const next = Math.max(min, Math.min(n, top));
    if (next !== value) onChange(next);
  };
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label={`Diminuir ${name}`}
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
      >
        <MinusIcon />
      </Button>
      <input
        aria-label={name}
        inputMode="numeric"
        className="h-8 w-12 rounded-lg border bg-transparent text-center text-sm tabular-nums"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          if (digits !== "") set(Math.trunc(Number(digits)));
        }}
      />
      <Button
        variant="outline"
        size="icon"
        aria-label={`Aumentar ${name}`}
        disabled={disabled}
        onClick={() => set(value + 1)}
      >
        <PlusIcon />
      </Button>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
