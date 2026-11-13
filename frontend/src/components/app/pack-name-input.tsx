"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { PACK_NAME_SUGGESTIONS } from "@/lib/format";

/** Nome da embalagem: sugere os nomes comuns e aceita qualquer outro digitado. */
export function PackNameInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  return (
    <>
      <Input
        id={id}
        list={listId}
        maxLength={20}
        autoComplete="off"
        placeholder="fardo"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {PACK_NAME_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}
