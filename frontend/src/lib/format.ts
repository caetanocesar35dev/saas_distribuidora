import type {
  BottleMovementType,
  NotificationType,
  PaymentMethod,
  Role,
  SaleStatus,
  SubscriptionStatus,
} from "@/lib/api/types";

export const TIME_ZONE = "America/Sao_Paulo";

const moneyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatMoney(value: number | null | undefined): string {
  return moneyFormat.format(value ?? 0);
}

/** Preço de plano: o backend guarda em centavos. */
export function formatCents(cents: number): string {
  return formatMoney(cents / 100);
}

const intFormat = new Intl.NumberFormat("pt-BR");
export const formatInt = (value: number) => intFormat.format(value);

/**
 * Nome de pessoa (usuário, convidado): só letras (com acento, de qualquer idioma), espaço,
 * apóstrofo, hífen e ponto, começando por letra. Números e símbolos não entram. É a mesma regra do
 * backend. Nome de loja, empresa e produto PODE ter número: não use esta regra neles.
 */
export const PERSON_NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;
export const PERSON_NAME_MESSAGE = "O nome deve ter só letras (sem números ou símbolos).";

export const isValidPersonName = (value: string) => PERSON_NAME_REGEX.test(value.trim());

/** Tira o que não pode estar num nome de pessoa (números e símbolos), para o campo digitado ou colado. */
export const cleanPersonName = (value: string) => value.replace(/[^\p{L}\p{M} '’.-]/gu, "");

/**
 * Endereço em uma linha: "Rua A, 10 - Sala 3 · Centro · Recife/PE · CEP 50030-230". Campos
 * vazios são pulados; sem nada, devolve "".
 */
export function formatAddress(a: {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}): string {
  const street = [a.street && (a.number ? `${a.street}, ${a.number}` : a.street), a.complement]
    .filter(Boolean)
    .join(" - ");
  const city = a.city ? (a.state ? `${a.city}/${a.state}` : a.city) : (a.state ?? "");
  return [street, a.neighborhood, city, a.zipCode && `CEP ${a.zipCode}`]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Quantidade de um item de venda ou comanda (venda em lote): "2 fardos de 12 + 3 un." ou "5 un.".
 * `units` é o total em unidades; `packs` × `packSize` são os fardos contidos nele.
 */
export function formatItemQuantity(
  units: number,
  packs: number | null | undefined,
  packSize: number | null | undefined,
): string {
  if (!packs || !packSize) return `${formatInt(units)} un.`;
  const loose = units - packs * packSize;
  const fardos = `${formatInt(packs)} ${packs === 1 ? "fardo" : "fardos"} de ${formatInt(packSize)}`;
  return loose > 0 ? `${fardos} + ${formatInt(loose)} un.` : fardos;
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (iso: string | Date) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string | Date) => dateTimeFormat.format(new Date(iso));
export const formatTime = (iso: string | Date) => timeFormat.format(new Date(iso));

/** "AAAA-MM-DD" (dia do calendário) para exibição, sem passar por fuso. */
export function formatDayString(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** Dia de hoje (AAAA-MM-DD) no fuso de São Paulo, o mesmo usado pelo backend. */
export function todayString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export function addDaysToDayString(day: string, amount: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + amount));
  return date.toISOString().slice(0, 10);
}

/** Quantos dias faltam até a data (arredondando para cima; 0 se já passou). */
export function daysUntil(iso: string, now = new Date()): number {
  const diff = new Date(iso).getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / 86_400_000);
}

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

/**
 * CNPJ sem máscara e em maiúsculas. Desde julho de 2026 o CNPJ pode ser alfanumérico: os 12
 * primeiros caracteres são letras ou dígitos; os 2 últimos continuam numéricos.
 */
export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[.\-/\s]/g, "");
}

export function formatCnpj(value: string | null | undefined): string {
  const d = normalizeCnpj(value ?? "");
  if (!/^[0-9A-Z]{14}$/.test(d)) return value ?? "";
  return maskCnpj(d);
}

/** Máscara 00.000.000/0000-00 enquanto digita (aceita letras nos 12 primeiros). */
export function maskCnpj(value: string): string {
  const d = value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 14);
  const separators: Record<number, string> = { 2: ".", 5: ".", 8: "/", 12: "-" };
  let out = "";
  for (let i = 0; i < d.length; i++) out += (i > 0 && separators[i] ? separators[i] : "") + d[i];
  return out;
}

/**
 * Máscara de telefone (fixo ou celular) enquanto digita: (81) 3333-4444 ou (81) 99999-0000. Até
 * 10 dígitos formata como fixo; com 11, como celular.
 */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone fixo (10 dígitos) ou celular (11, começando por 9 depois do DDD). */
export const isValidPhone = (value: string) =>
  /^[1-9]{2}(?:[2-8]\d{7}|9\d{8})$/.test(onlyDigits(value));

/** Sigla de estado enquanto digita: só letras, maiúsculas, até 2. */
export const maskUf = (value: string) =>
  value
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 2);

/** Máscara de celular enquanto digita: (81) 99999-0000. */
export function maskMobile(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Celular brasileiro: DDD + 9 dígitos começando por 9 (mesma regra do backend). */
export const isValidMobile = (value: string) => /^[1-9]{2}9\d{8}$/.test(onlyDigits(value));

export function formatPhone(value: string | null | undefined): string {
  const d = onlyDigits(value ?? "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value ?? "";
}

/**
 * Lê um valor em reais digitado pelo usuário ("1.234,56", "10,5", "10.50", "R$ 5").
 * Devolve null se não for um número válido.
 */
export function parseMoney(text: string): number | null {
  let t = text.replace(/R\$/g, "").replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if ((t.match(/\./g) ?? []).length > 1) {
    t = t.replace(/\./g, "");
  } else if (/^\d{1,3}\.\d{3}$/.test(t)) {
    // "1.234" sem vírgula: milhar
    t = t.replace(".", "");
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/** Número com vírgula decimal e ponto de milhar para preencher um campo de texto ("1.234,50"). */
export function moneyToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const [int, dec] = value.toFixed(2).split(".");
  return `${groupThousands(int)},${dec}`;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Formata o campo de dinheiro enquanto a pessoa digita: põe o ponto de milhar sozinho
 * ("1234" → "1.234"), aceita a vírgula decimal (no máximo 2 casas) e trata um "." digitado como
 * vírgula (o ponto do teclado numérico), porque o ponto de milhar quem põe é o campo. Texto colado
 * de uma vez segue a mesma leitura de `parseMoney` ("10.50" é dez e cinquenta; "1.234" é milhar).
 * `prev` é o texto que estava no campo antes desta mudança.
 */
export function formatMoneyTyping(next: string, prev: string): string {
  let t = next.replace(/R\$/g, "").replace(/\s/g, "");
  const before = prev.replace(/\s/g, "");
  // Uma tecla (um caractere a mais ou a menos): os pontos que já estavam são do milhar.
  const typing = before !== "" && Math.abs(t.length - before.length) === 1;
  if (typing && t.length === before.length + 1) {
    let i = 0;
    while (i < before.length && t[i] === before[i]) i++;
    if (t[i] === ".") t = `${t.slice(0, i)},${t.slice(i + 1)}`;
  }

  let int: string;
  let dec: string | null = null;
  const comma = t.indexOf(",");
  if (comma >= 0) {
    int = t.slice(0, comma);
    dec = t.slice(comma + 1).replace(/\D/g, "").slice(0, 2);
  } else if (!typing && (t.match(/\./g) ?? []).length === 1 && !/^\d{1,3}\.\d{3}$/.test(t)) {
    // Colado "10.50": o ponto é a casa decimal.
    [int, dec] = t.split(".");
    dec = dec.replace(/\D/g, "").slice(0, 2);
  } else {
    int = t;
  }

  int = int.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (dec !== null && int === "") int = "0";
  return groupThousands(int) + (dec !== null ? `,${dec}` : "");
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ---- Rótulos ---------------------------------------------------------------------------------

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  MONEY: "Dinheiro",
  PIX: "PIX",
  DEBIT: "Cartão de débito",
  CREDIT: "Cartão de crédito",
  CREDIT_STORE: "Fiado",
};

export const PAYMENT_METHODS: PaymentMethod[] = ["MONEY", "PIX", "DEBIT", "CREDIT", "CREDIT_STORE"];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Dono",
  MANAGER: "Gerente",
  EMPLOYEE: "Atendente",
};

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

export const BOTTLE_MOVEMENT_LABEL: Record<BottleMovementType, string> = {
  CUSTOMER_BORROW: "Empréstimo ao cliente",
  CUSTOMER_RETURN: "Devolução do cliente",
  SUPPLIER_SEND: "Envio ao fornecedor",
  SUPPLIER_RECEIVE: "Recebimento do fornecedor",
  MANUAL_ADJUSTMENT: "Ajuste manual",
};

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  TRIAL: "Em teste",
  ACTIVE: "Ativa",
  PAST_DUE: "Pagamento em atraso",
  CANCELED: "Cancelada",
};

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  NEWS: "Novidade",
  UPDATE: "Atualização",
  MAINTENANCE: "Manutenção",
  ALERT: "Aviso",
};

const ROLE_ORDER: Record<Role, number> = { EMPLOYEE: 1, MANAGER: 2, OWNER: 3 };

/** O papel `role` atinge pelo menos o papel `min`? (OWNER > MANAGER > EMPLOYEE) */
export function hasMinRole(role: Role | null | undefined, min: Role): boolean {
  return !!role && ROLE_ORDER[role] >= ROLE_ORDER[min];
}

/**
 * Confere formato e dígitos verificadores do CNPJ numérico ou alfanumérico (o backend faz a
 * mesma conferência). Cada caractere vale o código ASCII menos 48 (dígito = ele mesmo, A = 17).
 */
export function isValidCnpj(value: string): boolean {
  const d = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || /^(.)\1+$/.test(d)) return false;
  const calc = (base: string) => {
    let factor = base.length - 7;
    let sum = 0;
    for (const ch of base) {
      sum += (ch.charCodeAt(0) - 48) * factor--;
      if (factor < 2) factor = 9;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const first = calc(d.slice(0, 12));
  const second = calc(d.slice(0, 12) + String(first));
  return d.endsWith(`${first}${second}`);
}

/** Só aceita caminhos internos (evita redirecionar para outro site pelo parâmetro `next`). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return null;
  }
  return next;
}

/** Início do dia (AAAA-MM-DD) no fuso de São Paulo, em ISO, para filtros por período. */
export function dayStartIso(day: string): string {
  return new Date(`${day}T00:00:00-03:00`).toISOString();
}

/** Fim do dia (AAAA-MM-DD) no fuso de São Paulo, em ISO. */
export function dayEndIso(day: string): string {
  return new Date(`${day}T23:59:59.999-03:00`).toISOString();
}

/** ISO -> valor de um `<input type="datetime-local">` (horário local do navegador). */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor de um `<input type="datetime-local">` -> ISO (vazio vira `undefined`). */
export function fromDatetimeLocal(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}
