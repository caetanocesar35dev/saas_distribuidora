"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cleanPersonName, moneyToInput, parseMoney } from "@/lib/format";
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

// ---- Nome de pessoa --------------------------------------------------------------------------

/**
 * Campo de nome de pessoa: números e símbolos não entram (digitados ou colados). Serve também com
 * `{...register("name")}` do React Hook Form (o valor limpo é o que ele lê).
 */
export function PersonNameInput({ onChange, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      autoComplete="name"
      maxLength={120}
      {...props}
      onChange={(e) => {
        const cleaned = cleanPersonName(e.target.value);
        if (cleaned !== e.target.value) e.target.value = cleaned;
        onChange?.(e);
      }}
    />
  );
}

// ---- Senha -----------------------------------------------------------------------------------

/**
 * Campo de senha com o botão de olho para mostrar ou esconder o que foi digitado. Serve também com
 * `{...register("password")}` do React Hook Form. Começa escondido, e o botão não entra na ordem do
 * Tab (para o Enter e o Tab do formulário seguirem normais).
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder a senha" : "Mostrar a senha"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

// ---- Campo com máscara -----------------------------------------------------------------------

/**
 * Campo que aplica uma máscara enquanto a pessoa digita ou cola (telefone, CEP, UF...). Serve com
 * `{...register("campo")}` do React Hook Form: o valor que ele lê já vem formatado.
 */
export function MaskedInput({
  mask,
  onChange,
  ...props
}: React.ComponentProps<typeof Input> & { mask: (value: string) => string }) {
  return (
    <Input
      {...props}
      onChange={(e) => {
        const masked = mask(e.target.value);
        if (masked !== e.target.value) e.target.value = masked;
        onChange?.(e);
      }}
    />
  );
}
