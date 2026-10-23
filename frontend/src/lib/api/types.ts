/**
 * Contratos da API do backend. O Swagger do backend não descreve corpos nem respostas, então estes
 * tipos foram escritos a partir dos DTOs e dos services (backend/src/**). Datas chegam como texto
 * ISO 8601; dinheiro como número (reais, 2 casas). Fonte única: nenhuma tela declara o formato
 * de uma resposta por conta própria.
 */

// ---- Enumerações -----------------------------------------------------------------------------

export type Role = "OWNER" | "MANAGER" | "EMPLOYEE";
export type PlatformRole = "SUPPORT" | "SUPERADMIN";
export type PaymentMethod = "MONEY" | "PIX" | "DEBIT" | "CREDIT" | "CREDIT_STORE";
export type SaleStatus = "COMPLETED" | "CANCELED";
export type CashStatus = "OPEN" | "CLOSED";
export type CashMovementType = "IN" | "OUT" | "SALE";
export type TabStatus = "OPEN" | "CLOSED";
export type BottleMovementType =
  | "CUSTOMER_BORROW"
  | "CUSTOMER_RETURN"
  | "SUPPLIER_SEND"
  | "SUPPLIER_RECEIVE"
  | "MANUAL_ADJUSTMENT";
export type ManualBottleMovementType =
  | "SUPPLIER_SEND"
  | "SUPPLIER_RECEIVE"
  | "MANUAL_ADJUSTMENT";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED";
export type NotificationType = "NEWS" | "UPDATE" | "MAINTENANCE" | "ALERT";
export type AccessMode = "FULL" | "GRACE" | "READ_ONLY";
export type ReadOnlyReason = "TRIAL_EXPIRED" | "PAST_DUE" | "CANCELED";

// ---- Genéricos -------------------------------------------------------------------------------

export interface PageMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface MessageResponse {
  message: string;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}

// ---- Autenticação e conta --------------------------------------------------------------------

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
}

export interface Profile extends SessionUser {
  createdAt: string;
}

/** O BFF devolve só o usuário: os tokens ficam em cookies httpOnly. */
export interface AuthResponse {
  user: SessionUser;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface SignupBody {
  name: string;
  email: string;
  password: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  storeName: string;
  planId?: string;
  /** Aceite dos termos de uso e da política de privacidade (obrigatório). */
  acceptTerms: boolean;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordBody {
  token: string;
  newPassword: string;
}

export interface SubscriptionAccess {
  status: SubscriptionStatus;
  accessMode: AccessMode;
  reason: ReadOnlyReason | null;
  trialEndsAt: string | null;
  pastDueSince: string | null;
  graceEndsAt: string | null;
}

export interface MembershipStoreView {
  storeId: string;
  storeName: string;
  role: Role;
}

export interface Membership {
  companyId: string;
  companyName: string;
  organizationId: string;
  isCompanyOwner: boolean;
  isBillingOwner: boolean;
  subscription: SubscriptionAccess;
  stores: MembershipStoreView[];
}

export interface Plan {
  id: string;
  name: string;
  priceInCents: number;
  maxCompanies: number | null;
  maxStoresPerCompany: number | null;
}

// ---- Empresa, lojas e equipe -----------------------------------------------------------------

export interface Company {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  organizationId: string;
  createdAt?: string;
}

export interface UpdateCompanyBody {
  razaoSocial?: string;
  nomeFantasia?: string;
}

export interface Store {
  id: string;
  companyId: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
}

export interface StoreBody {
  name: string;
  cnpj?: string;
  phone?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface Member {
  membershipId: string;
  user: { id: string; name: string; email: string; isActive: boolean };
  stores: MembershipStoreView[];
}

export interface InviteMemberBody {
  email: string;
  name: string;
  stores: { storeId: string; role: Role }[];
}

export interface InviteMemberResponse {
  membershipId: string;
  userId: string;
  invitedNewUser: boolean;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  pastDueSince: string | null;
  plan: {
    id: string;
    name: string;
    maxCompanies: number | null;
    maxStoresPerCompany: number | null;
  };
  companies: { id: string; razaoSocial: string; nomeFantasia: string | null }[];
  isBillingOwner: boolean;
}

export interface CreateCompanyBody {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  storeName: string;
}

// ---- Catálogo --------------------------------------------------------------------------------

export interface BottleType {
  id: string;
  companyId: string;
  name: string;
  createdAt: string;
}

export interface BottleTypeRef {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  companyId: string;
  code: string;
  name: string;
  packQuantity: number;
  bottleTypeId: string | null;
  bottleType: BottleTypeRef | null;
  createdAt: string;
}

export interface ProductOfferSummary {
  id: string;
  storeId: string;
  price: number;
  /** Não vem para o atendente (o backend tira custo e lucro das respostas). */
  costPrice?: number;
  stock: number;
  isActive: boolean;
}

export interface ProductDetail extends Product {
  storeProducts: ProductOfferSummary[];
}

export interface CreateProductBody {
  name: string;
  code?: string;
  packQuantity?: number;
  bottleTypeId?: string;
  costPrice?: number;
  stores?: { storeId: string; price: number; costPrice?: number }[];
}

export interface UpdateProductBody {
  name?: string;
  packQuantity?: number;
  bottleTypeId?: string | null;
}

/** Oferta de um produto numa loja (o que o PDV e o estoque listam). */
export interface StoreProduct {
  id: string;
  storeId: string;
  productId: string;
  price: number;
  /** Não vem para o atendente. */
  costPrice?: number;
  stock: number;
  isActive: boolean;
  product: {
    code: string;
    name: string;
    packQuantity: number;
    bottleTypeId: string | null;
    bottleType: BottleTypeRef | null;
  };
}

export interface AddStoreProductBody {
  productId: string;
  price: number;
  costPrice?: number;
  stock?: number;
}

export interface UpdateStoreProductBody {
  price?: number;
  costPrice?: number;
  isActive?: boolean;
}

// ---- Vasilhames ------------------------------------------------------------------------------

export interface BottleStockLine {
  bottleTypeId: string;
  bottleTypeName: string;
  stock: number;
}

export interface BottleMovement {
  id: string;
  storeId: string;
  bottleTypeId: string;
  bottleType: BottleTypeRef;
  quantity: number;
  type: BottleMovementType;
  description: string | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  saleId: string | null;
  createdAt: string;
}

export interface ManualBottleMovementBody {
  bottleTypeId: string;
  type: ManualBottleMovementType;
  quantity: number;
  description?: string;
}

export interface CustomerBottleBody {
  bottleTypeId: string;
  quantity: number;
  description?: string;
}

export interface BottleMovementsQuery extends PageQuery {
  type?: BottleMovementType;
  customerId?: string;
  bottleTypeId?: string;
  from?: string;
  to?: string;
}

// ---- Caixa -----------------------------------------------------------------------------------

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface CashRegister {
  id: string;
  storeId: string;
  openedAt: string;
  closedAt: string | null;
  initialBalance: number;
  finalBalance: number | null;
  status: CashStatus;
}

export interface CurrentCashRegister extends CashRegister {
  movements: CashMovement[];
  currentBalance: number;
}

export interface PaymentSummaryLine {
  paymentMethod: PaymentMethod;
  count: number;
  total: number;
}

export interface CashRegisterDetail extends CurrentCashRegister {
  summary: PaymentSummaryLine[];
}

export interface CloseCashResponse {
  register: CashRegister;
  summary: PaymentSummaryLine[];
}

export interface CashMovementBody {
  type: "IN" | "OUT";
  amount: number;
  description?: string;
}

// ---- Vendas e comandas -----------------------------------------------------------------------

export interface SaleItem {
  id: string;
  storeProductId: string;
  /** Total em unidades (já com os fardos). */
  quantity: number;
  /** Venda em lote: quantos fardos estão em `quantity`. */
  packs: number;
  /** Unidades por fardo na hora da venda (null = vendido só por unidade). */
  packSize: number | null;
  price: number;
  costPrice?: number; // não vem para o atendente
  storeProduct: { product: { code: string; name: string } };
}

export interface SaleBottleMovement {
  id: string;
  type: BottleMovementType;
  quantity: number;
  bottleTypeId: string;
  bottleType: { name: string };
  description: string | null;
}

export interface Sale {
  id: string;
  storeId: string;
  total: number;
  totalCost?: number; // não vem para o atendente
  discount: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  /** Quando a venda aconteceu. */
  createdAt: string;
  /** Venda antiga lançada depois: quando foi lançada. null = lançada na hora. */
  registeredAt: string | null;
  userId: string;
  user: { id: string; name: string };
  customerId: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  commandTabId: string | null;
  items: SaleItem[];
  bottleMovements: SaleBottleMovement[];
}

export interface SalesPage extends Paginated<Sale> {
  /** `totalProfit` não vem para o atendente. */
  meta: PageMeta & { totalRevenue: number; totalProfit?: number };
}

export interface BottleReturnLine {
  bottleTypeId: string;
  quantity: number;
}

/** Preço e custo NUNCA vão na venda: o backend lê do banco. */
export interface CreateSaleBody {
  paymentMethod: PaymentMethod;
  customerId?: string;
  discount?: number;
  /** `quantity` = unidades avulsas; `packs` = fardos (o backend converte em unidades). */
  items: { storeProductId: string; quantity: number; packs?: number }[];
  bottleReturns?: BottleReturnLine[];
  /** Gerente ou dono confirmou a venda fiada acima do limite de crédito. */
  allowOverCreditLimit?: boolean;
}

/** Venda antiga lançada depois (só gerente e dono): o mesmo corpo, mais quando ela aconteceu. */
export interface CreateLateSaleBody extends CreateSaleBody {
  /** Data e hora da venda (ISO). Não pode ser no futuro. */
  soldAt: string;
}

export interface SalesQuery extends PageQuery {
  search?: string;
  paymentMethod?: PaymentMethod;
  status?: SaleStatus;
  customerId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CommandItem {
  id: string;
  storeProductId: string;
  /** Total em unidades (já com os fardos). */
  quantity: number;
  packs: number;
  packSize: number | null;
  price: number;
  costPrice?: number; // não vem para o atendente
  addedAt: string;
  storeProduct: { product: { code: string; name: string } };
}

export interface CommandTab {
  id: string;
  storeId: string;
  name: string;
  status: TabStatus;
  createdAt: string;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  items: CommandItem[];
  total: number;
}

export interface CloseCommandTabBody {
  paymentMethod: PaymentMethod;
  discount?: number;
  customerId?: string;
  bottleReturns?: BottleReturnLine[];
  allowOverCreditLimit?: boolean;
}

// ---- Clientes e fiado ------------------------------------------------------------------------

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone: string | null;
  /** Limite de crédito do fiado (soma de todas as lojas); null = sem limite. */
  creditLimit: number | null;
  createdAt: string;
}

/** Item da lista de clientes: já vem com a dívida de fiado por loja (só lojas que a pessoa vê). */
export interface CustomerListItem extends Customer {
  debts: { storeId: string; balance: number }[];
}

export interface CustomerBody {
  name: string;
  phone?: string;
  /** Só gerente e dono podem enviar. null tira o limite. */
  creditLimit?: number | null;
}

export interface CustomerBalances {
  /** Só gerente e dono recebem o total; funcionário recebe null. */
  total: number | null;
  /** Limite de crédito do fiado; null = sem limite. */
  creditLimit: number | null;
  perStore: {
    storeId: string;
    storeName: string;
    balance: number;
    /** Vendas fiadas em aberto (o pagamento quita primeiro as mais antigas). */
    openCreditSales: number;
    /** Data da venda fiada em aberto mais antiga. */
    oldestOpenCreditSaleAt: string | null;
  }[];
  bottles: {
    storeId: string;
    storeName: string;
    bottleTypeId: string;
    bottleTypeName: string;
    balance: number;
  }[];
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  storeId: string;
  store: { name: string };
  amount: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
  allocations: { storeId: string; amount: number; store: { name: string } }[];
}

export interface CreatePaymentBody {
  amount: number;
  paymentMethod: Exclude<PaymentMethod, "CREDIT_STORE">;
  allocations?: { storeId: string; amount: number }[];
}

// ---- Painéis ---------------------------------------------------------------------------------

export interface PeriodStats {
  revenue: number;
  profit: number;
  count: number;
}

export interface Dashboard {
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  topProducts: { productId: string; code: string; name: string; quantity: number }[];
  chart: { date: string; revenue: number; profit: number; count: number }[];
  lowStock: {
    storeProductId: string;
    storeId: string;
    storeName: string;
    code: string;
    name: string;
    stock: number;
  }[];
  debt: number;
  byStore?: {
    storeId: string;
    storeName: string;
    today: PeriodStats;
    week: PeriodStats;
    month: PeriodStats;
    debt: number;
  }[];
}

// ---- Histórico de alterações -----------------------------------------------------------------

export type VersionAction = "CREATED" | "UPDATED" | "DELETED" | "RESTORED";

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditVersion {
  version: number;
  historyStart: string;
  historyEnd: string | null;
  action: VersionAction;
  author: { id: string | null; name: string | null };
  endpoint: string | null;
  changes: FieldChange[] | null;
  snapshot: Record<string, unknown>;
}

export interface AuditHistory {
  entity: string;
  id: string;
  versions: AuditVersion[];
}

export type StoreAuditEntity =
  | "store-products"
  | "sales"
  | "command-tabs"
  | "cash-registers"
  | "bottle-movements";

export type CompanyAuditEntity =
  | "products"
  | "customers"
  | "bottle-types"
  | "stores"
  | "memberships"
  | "membership-stores";

// ---- Notificações ----------------------------------------------------------------------------

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  publishedAt: string;
  expiresAt: string | null;
  createdAt: string;
  read: boolean;
  readAt: string | null;
}

export interface UnreadCount {
  count: number;
}

// ---- Plataforma (SUPERADMIN / SUPPORT) -------------------------------------------------------

export interface PlatformPlan extends Plan {
  createdAt: string;
  organizations?: number;
}

export interface PlanBody {
  name: string;
  priceInCents: number;
  maxCompanies?: number | null;
  maxStoresPerCompany?: number | null;
}

export interface PlatformOrganizationRow {
  id: string;
  name: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  pastDueSince: string | null;
  createdAt: string;
  plan: { id: string; name: string };
  owner: { id: string; name: string; email: string };
  companies: number;
}

export interface PlatformOrganization {
  id: string;
  name: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  pastDueSince: string | null;
  billingProvider: string | null;
  billingMethod: string | null;
  createdAt: string;
  plan: PlatformPlan;
  owner: { id: string; name: string; email: string };
  companies: {
    id: string;
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    stores: { id: string; name: string }[];
  }[];
  userCount: number;
}

export interface UpdateOrganizationBody {
  subscriptionStatus?: SubscriptionStatus;
  planId?: string;
  trialEndsAt?: string | null;
  pastDueSince?: string | null;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  platformRole: PlatformRole | null;
  createdAt: string;
}

export interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  publishedAt: string;
  expiresAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  readCount: number;
}

export interface NotificationBody {
  title: string;
  body: string;
  type?: NotificationType;
  publishedAt?: string;
  expiresAt?: string | null;
}
