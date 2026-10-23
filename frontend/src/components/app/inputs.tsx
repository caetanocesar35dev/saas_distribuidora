"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moneyToInput, parseMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---- Valor em reais --------------------------------------------------------------------------

/**
 * Campo de dinheiro. O usuário digita "12,5" ou "1.234,56"; o valor sai como número (reais, 2
 * casas) ou `undefined` quando vazio/inválido. O texto fica livre enquanto ele digita.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  className,
  id,
  disabled,
  autoFocus,
  "aria-invalid": ariaInvalid,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-invalid"?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? "" : moneyToInput(value));
  const [lastValue, setLastValue] = useState(value);

  // Se o valor mudou por fora (ex.: formulário reiniciado), o texto acompanha.
  if (value !== lastValue) {
    setLastValue(value);
    if (parseMoney(text) !== value) {
      setText(value === undefined ? "" : moneyToInput(value));
    }
  }

  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
        R$
      </span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="pl-9 tabular-nums"
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={ariaInvalid}
        onChange={(e) => {
          const next = e.target.value;
          if (!/^[\d.,\sR$]*$/.test(next)) return;
          setText(next);
          const parsed = parseMoney(next);
          setLastValue(parsed ?? undefined);
          onChange(parsed ?? undefined);
        }}
        onBlur={() => {
          const parsed = parseMoney(text);
          if (parsed !== null) setText(moneyToInput(parsed));
        }}
      />
    </div>
  );
}

/** Quantidade inteira (estoque, itens). Vazio vira `undefined`. */
export function IntInput({
  value,
  onChange,
  min = 0,
  max,
  className,
  id,
  disabled,
  autoFocus,
  placeholder,
  "aria-invalid": ariaInvalid,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  className?: string;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  "aria-invalid"?: boolean;
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      step={1}
      min={min}
      max={max}
      className={cn("tabular-nums", className)}
      value={value ?? ""}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-invalid={ariaInvalid}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(undefined);
        const n = Math.trunc(Number(raw));
        onChange(Number.isFinite(n) ? n : undefined);
      }}
    />
  );
}

// ---- Lista de escolha ------------------------------------------------------------------------

export interface Option<V extends string = string> {
  value: V;
  label: string;
}

/**
 * Lista suspensa simples. O componente do shadcn (Base UI) precisa da lista de itens para mostrar o
 * texto da opção escolhida; este envelope cuida disso.
 */
export function SelectField<V extends string>({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  className,
  id,
  disabled,
  size,
}: {
  value: V | "" | undefined;
  onChange: (value: V) => void;
  options: Option<V>[];
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(v) => {
        if (v !== null) onChange(v as V);
      }}
      items={options}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)} size={size}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
