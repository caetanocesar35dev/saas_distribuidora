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
 * Ao completar um CEP (8 dígitos), consulta o endereço e preenche os campos que `pick` devolver
 * (valor null não preenche nada). Nunca apaga o que a pessoa digitou: só preenche campo vazio ou
 * que ainda tem o valor preenchido pela consulta anterior. Chame `onCepChange` no `onChange` do
 * campo de CEP.
 */
export function useCepAutofill<F extends string>(options: {
  get: (name: F) => string | undefined;
  set: (name: F, value: string) => void;
  pick: (data: CepData) => Record<F, string | null>;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const autofilled = useRef<Partial<Record<F, string>>>({});
  const pending = useRef<AbortController | null>(null);

  function fill(name: F, value: string) {
    const current = (options.get(name) ?? "").trim();
    if (current && current !== autofilled.current[name]) return;
    if (current === value) return;
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
