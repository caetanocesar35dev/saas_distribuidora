"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoriesManager } from "../configuracoes/categories-manager";

/** Atalho de Produtos para as categorias (a lista também fica em Configurações). */
export function CategoriesDialog({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorias de produto</DialogTitle>
          <DialogDescription>
            Valem para todas as lojas da empresa. Servem para filtrar os produtos e ver o faturamento
            por categoria no painel.
          </DialogDescription>
        </DialogHeader>
        <CategoriesManager companyId={companyId} scroll />
      </DialogContent>
    </Dialog>
  );
}
