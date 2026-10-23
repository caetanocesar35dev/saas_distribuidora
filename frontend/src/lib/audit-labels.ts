import {
  BOTTLE_MOVEMENT_LABEL,
  formatDateTime,
  formatMoney,
  PAYMENT_METHOD_LABEL,
  ROLE_LABEL,
} from "@/lib/format";
import type { VersionAction } from "@/lib/api/types";

export const ACTION_LABEL: Record<VersionAction, string> = {
  CREATED: "Criado",
  UPDATED: "Alterado",
  DELETED: "Excluído",
  RESTORED: "Reativado",
};

/** Nomes amigáveis dos campos que aparecem no histórico (o resto usa o nome do campo). */
const FIELD_LABEL: Record<string, string> = {
  name: "Nome",
  code: "Código de barras",
  price: "Preço",
  costPrice: "Custo",
  stock: "Estoque",
  isActive: "Ativo",
  packQuantity: "Quantidade por fardo",
  bottleTypeId: "Tipo de vasilhame",
  phone: "Telefone",
  cnpj: "CNPJ",
  razaoSocial: "Razão social",
  nomeFantasia: "Nome fantasia",
  zipCode: "CEP",
  street: "Rua",
  number: "Número",
  complement: "Complemento",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "Estado",
  role: "Papel",
  status: "Situação",
  total: "Total",
  totalCost: "Custo total",
  discount: "Desconto",
  paymentMethod: "Forma de pagamento",
  customerId: "Cliente",
  initialBalance: "Saldo inicial",
  finalBalance: "Saldo final",
  openedAt: "Aberto em",
  closedAt: "Fechado em",
  quantity: "Quantidade",
  packs: "Fardos",
  packSize: "Unidades por fardo",
  registeredAt: "Lançada em",
  creditLimit: "Limite de crédito",
  termsAcceptedAt: "Aceite dos termos",
  termsVersion: "Versão dos termos",
  type: "Tipo",
  description: "Descrição",
  amount: "Valor",
};

/** Campos que mudam sozinhos ou que já aparecem como ação (Excluído/Reativado). */
const HIDDEN_FIELDS = new Set(["updatedAt", "deletedAt"]);

const MONEY_FIELDS = new Set([
  "price",
  "costPrice",
  "total",
  "totalCost",
  "discount",
  "initialBalance",
  "finalBalance",
  "amount",
]);

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

export function isHiddenField(field: string): boolean {
  return HIDDEN_FIELDS.has(field);
}

/** Valores de campos que são listas fixas do sistema (o histórico guarda o código em inglês). */
const ENUM_LABEL: Record<string, Record<string, string>> = {
  status: {
    COMPLETED: "Concluída",
    CANCELED: "Cancelada",
    OPEN: "Aberto",
    CLOSED: "Fechado",
  },
  paymentMethod: PAYMENT_METHOD_LABEL,
  role: ROLE_LABEL,
  type: { ...BOTTLE_MOVEMENT_LABEL, IN: "Entrada", OUT: "Saída", SALE: "Venda" },
};

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "vazio";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string" && ENUM_LABEL[field]?.[value]) return ENUM_LABEL[field][value];
  if (typeof value === "number") {
    return MONEY_FIELDS.has(field) ? formatMoney(value) : String(value);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
    return value;
  }
  return JSON.stringify(value);
}
