"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/lib/api/types";
import { formatInt } from "@/lib/format";

/** Navegação entre páginas de uma lista paginada pelo backend (`?page=&limit=`). */
export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) {
    return meta.totalItems > 0 ? (
      <p className="pt-2 text-xs text-muted-foreground">
        {formatInt(meta.totalItems)} {meta.totalItems === 1 ? "registro" : "registros"}
      </p>
    ) : null;
  }
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-xs text-muted-foreground">
        Página {meta.page} de {meta.totalPages} · {formatInt(meta.totalItems)} registros
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeftIcon /> Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Próxima <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
