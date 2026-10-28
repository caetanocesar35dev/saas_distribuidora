"use client";

import { useRef, useState } from "react";
import { lookupCnpj, type CnpjData, type CnpjLookupResult } from "@/lib/cnpj-lookup";
import { isValidCnpj } from "@/lib/format";

type Status = "idle" | "loading" | CnpjLookupResult["status"];

/** Razão social e nome fantasia: cadastro e "Nova empresa". */
export const companyFieldsFromCnpj = (data: CnpjData) => ({
  razaoSocial: data.razaoSocial,
  nomeFantasia: data.nomeFantasia,
});

const HINTS: Record<Exclude<Status, "found">, string> = {
  idle: "Pode ter letras e números. Ao completar, buscamos a razão social e o nome fantasia.",
  loading: "Buscando os dados do CNPJ...",
  "not-found": "CNPJ não encontrado na consulta pública. Preencha os dados abaixo.",
  unavailable: "Não foi possível consultar o CNPJ agora. Preencha os dados abaixo.",
};

/**
 * Ao completar um CNPJ válido, consulta os dados públicos e preenche os campos que `pick` devolver
 * (valor null não preenche nada). Nunca apaga o que a pessoa digitou: só preenche campo vazio ou
 * que ainda tem o valor preenchido pela consulta anterior. Chame `onCnpjChange` no `onChange` do
 * campo de CNPJ.
 */
export function useCnpjAutofill<F extends string>(options: {
  get: (name: F) => string | undefined;
  set: (name: F, value: string) => void;
  pick: (data: CnpjData) => Record<F, string | null>;
  hints?: Partial<Record<Status, string>>;
}) {
  const [status, setStatus] = useState<Status>("idle");
  // Dados da última consulta que achou o CNPJ (o cadastro usa o endereço para a primeira loja).
  const [found, setFound] = useState<CnpjData | null>(null);
  const autofilled = useRef<Partial<Record<F, string>>>({});
  const pending = useRef<AbortController | null>(null);

  function fill(name: F, value: string) {
    const current = (options.get(name) ?? "").trim();
    if (current && current !== autofilled.current[name]) return;
    if (current === value) return;
    options.set(name, value);
    autofilled.current[name] = value;
  }

  function onCnpjChange(value: string) {
    pending.current?.abort();
    pending.current = null;
    if (!isValidCnpj(value)) {
      setStatus("idle");
      setFound(null);
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setStatus("loading");
    lookupCnpj(value, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.status === "found") {
          const values = options.pick(result.data);
          for (const name of Object.keys(values) as F[]) fill(name, values[name] ?? "");
        }
        setStatus(result.status);
        setFound(result.status === "found" ? result.data : null);
      })
      .catch(() => {
        // consulta cancelada porque o CNPJ mudou
      });
  }

  const hint =
    options.hints?.[status] ??
    (status === "found"
      ? "Dados preenchidos com a consulta pública do CNPJ. Confira antes de continuar."
      : HINTS[status]);
  return { status, hint, found, onCnpjChange };
}
