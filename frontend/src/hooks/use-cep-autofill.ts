"use client";

import { useRef, useState } from "react";
import { lookupCep, type CepData, type CepLookupResult } from "@/lib/cep-lookup";
import { onlyDigits } from "@/lib/format";

type Status = "idle" | "loading" | CepLookupResult["status"];

const HINTS: Record<Status, string> = {
  idle: "Ao completar o CEP, buscamos rua, bairro, cidade e UF.",
  loading: "Buscando o endereço do CEP...",
  found: "Endereço preenchido pelo CEP. Complete o número e o complemento.",
  "not-found": "CEP não encontrado. Preencha o endereço abaixo.",
  unavailable: "Não foi possível consultar o CEP agora. Preencha o endereço abaixo.",
};

/**
 * Se a consulta pode gravar `value` no campo: só quando ele está vazio ou ainda tem o último valor
 * preenchido por ela (ou o salvo, na edição), e o valor muda. O que a pessoa digitou fica.
 */
export function canAutofill(
  current: string | undefined,
  lastFilled: string | undefined,
  value: string,
): boolean {
  const now = (current ?? "").trim();
  if (now && now !== (lastFilled ?? "").trim()) return false;
  return now !== value;
}

/**
 * Ao completar um CEP (8 dígitos), consulta o endereço e preenche os campos que `pick` devolver
 * (valor null não preenche nada). Nunca apaga o que a pessoa digitou: só preenche campo vazio ou
 * que ainda tem o valor preenchido pela consulta anterior. Chame `onCepChange` no `onChange` do
 * campo de CEP.
 *
 * `initial` é o endereço que já estava salvo (edição): ao trocar o CEP, ele é substituído pelo do
 * CEP novo, mas o que a pessoa mudou à mão nesta edição continua valendo.
 */
export function useCepAutofill<F extends string>(options: {
  get: (name: F) => string | undefined;
  set: (name: F, value: string) => void;
  pick: (data: CepData) => Record<F, string | null>;
  initial?: Partial<Record<F, string>>;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const autofilled = useRef<Partial<Record<F, string>>>({ ...options.initial });
  const pending = useRef<AbortController | null>(null);

  function fill(name: F, value: string) {
    if (!canAutofill(options.get(name), autofilled.current[name], value)) return;
    options.set(name, value);
    autofilled.current[name] = value;
  }

  function onCepChange(value: string) {
    pending.current?.abort();
    pending.current = null;
    if (onlyDigits(value).length !== 8) {
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setStatus("loading");
    lookupCep(value, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.status === "found") {
          const values = options.pick(result.data);
          for (const name of Object.keys(values) as F[]) fill(name, values[name] ?? "");
        }
        setStatus(result.status);
      })
      .catch(() => {
        // consulta cancelada porque o CEP mudou
      });
  }

  return { status, hint: HINTS[status], onCepChange };
}
