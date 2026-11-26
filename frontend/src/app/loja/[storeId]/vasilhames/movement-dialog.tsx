"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/app/form";
import { IntInput, SelectField } from "@/components/app/inputs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useBottleStock,
  useRegisterBottleMovement,
  useSuppliers,
} from "@/lib/api/hooks/bottles";
import type { ManualBottleMovementType } from "@/lib/api/types";
import { BOTTLE_MOVEMENT_LABEL, formatInt } from "@/lib/format";
import { useStore } from "@/lib/session/context";

const TEXT: Record<ManualBottleMovementType, { description: string; button: string }> = {
  SUPPLIER_SEND: {
    description: "Vasilhames vazios que a loja devolveu ao fornecedor. Saem do estoque da loja.",
    button: "Registrar envio",
  },
  SUPPLIER_RECEIVE: {
    description: "Vasilhames que o fornecedor entregou à loja. Entram no estoque da loja.",
    button: "Registrar recebimento",
  },
  MANUAL_ADJUSTMENT: {
    description:
      "Correção de contagem ou de quebra. Use só quando o estoque do sistema não bate com o real.",
    button: "Registrar ajuste",
  },
};

type Direction = "in" | "out";

/** Valor da opção "Não informar" do fornecedor (o Select não aceita valor vazio). */
const NO_SUPPLIER = "none";

/** Movimentação manual de vasilhame. O estoque de vasilhame só muda por movimentação. */
export function MovementDialog({
  type,
  onClose,
}: {
  type: ManualBottleMovementType;
  onClose: () => void;
}) {
  const { storeId, companyId } = useStore();
  const stock = useBottleStock(storeId);
  const register = useRegisterBottleMovement(storeId);
  const withSupplier = type !== "MANUAL_ADJUSTMENT";
  const suppliers = useSuppliers(companyId);
  const [bottleTypeId, setBottleTypeId] = useState("");
  const [supplierId, setSupplierId] = useState<string>(NO_SUPPLIER);
  const [quantity, setQuantity] = useState<number | undefined>();
  const [direction, setDirection] = useState<Direction>("in");
  const [description, setDescription] = useState("");
  const supplierList = suppliers.data ?? [];

  const lines = stock.data ?? [];
  const selected = lines.find((l) => l.bottleTypeId === bottleTypeId);
  const valid = bottleTypeId !== "" && !!quantity && quantity >= 1;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{BOTTLE_MOVEMENT_LABEL[type]}</DialogTitle>
          <DialogDescription>{TEXT[type].description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid || !quantity) return;
            const signed = type === "MANUAL_ADJUSTMENT" && direction === "out" ? -quantity : quantity;
            register.mutate(
              {
                bottleTypeId,
                type,
                quantity: signed,
                description: description.trim() || undefined,
                supplierId: withSupplier && supplierId !== NO_SUPPLIER ? supplierId : undefined,
              },
              {
                onSuccess: () => {
                  toast.success("Movimentação registrada.");
                  onClose();
                },
              },
            );
          }}
        >
          <FormField label="Tipo de vasilhame" htmlFor="mv-type">
            <SelectField
              id="mv-type"
              value={bottleTypeId}
              onChange={setBottleTypeId}
              placeholder="Escolha o tipo"
              options={lines.map((l) => ({
                value: l.bottleTypeId,
                label: `${l.bottleTypeName} (na loja: ${formatInt(l.stock)})`,
              }))}
            />
          </FormField>
          {withSupplier && (
            <FormField
              label="Fornecedor (opcional)"
              htmlFor="mv-supplier"
              hint={
                supplierList.length === 0
                  ? "Nenhum fornecedor cadastrado. O gerente ou o dono cadastra em Menu › Configurações › Fornecedores."
                  : "Escolha para ver o saldo de cascos com ele na aba Fornecedores."
              }
            >
              <SelectField
                id="mv-supplier"
                value={supplierId}
                onChange={setSupplierId}
                options={[
                  { value: NO_SUPPLIER, label: "Não informar" },
                  ...supplierList.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </FormField>
          )}
          {type === "MANUAL_ADJUSTMENT" && (
            <FormField label="O ajuste" htmlFor="mv-direction">
              <SelectField<Direction>
                id="mv-direction"
                value={direction}
                onChange={setDirection}
                options={[
                  { value: "in", label: "Soma ao estoque (entrou)" },
                  { value: "out", label: "Tira do estoque (saiu ou quebrou)" },
                ]}
              />
            </FormField>
          )}
          <FormField
            label="Quantidade"
            htmlFor="mv-qty"
            hint={
              selected && type === "SUPPLIER_SEND"
                ? `Hoje a loja tem ${formatInt(selected.stock)}. O estoque não pode ficar negativo.`
                : undefined
            }
          >
            <IntInput id="mv-qty" min={1} max={1_000_000} value={quantity} onChange={setQuantity} />
          </FormField>
          <FormField label="Observação (opcional)" htmlFor="mv-desc">
            <Input
              id="mv-desc"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || register.isPending}>
              {register.isPending ? "Salvando..." : TEXT[type].button}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
