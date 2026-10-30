import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { PlatformRole, Role } from '@prisma/client';
import type { SubscriptionAccess } from '../utils/access-mode';

// ---- Tipos anexados à request pelos guards -------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
}

/** Contexto de uma rota de organização (/organizations/:organizationId/...). */
export interface OrgTenant {
  organizationId: string;
  /** O usuário é o responsável pela cobrança (Organization.ownerUserId). */
  isBillingOwner: boolean;
  subscription: SubscriptionAccess;
}

/** Contexto de uma rota de company (/companies/:companyId/...). */
export interface CompanyTenant extends OrgTenant {
  companyId: string;
  /** Maior papel do usuário nas lojas da company. */
  role: Role;
  membershipId: string;
  /** Gerente geral da company (gerente em todas as lojas, com o painel e a equipe). */
  isGeneralManager: boolean;
  /** Lojas da company às quais o usuário tem acesso. */
  storeIds: string[];
}

/** Contexto de uma rota de loja (/stores/:storeId/...). */
export interface StoreTenant extends CompanyTenant {
  storeId: string;
  /** Papel do usuário NESTA loja. */
  role: Role;
}

// ---- Hierarquia de papéis ----------------------------------------------------------------

const ROLE_LEVEL: Record<Role, number> = { OWNER: 3, MANAGER: 2, EMPLOYEE: 1 };

export function roleLevel(role: Role): number {
  return ROLE_LEVEL[role];
}

export function hasMinRole(role: Role, min: Role): boolean {
  return roleLevel(role) >= roleLevel(min);
}

export function maxRole(roles: Role[]): Role {
  return roles.reduce(
    (best, r) => (roleLevel(r) > roleLevel(best) ? r : best),
    roles[0],
  );
}

// ---- Metadados dos guards ------------------------------------------------------------------

export const IS_PUBLIC_KEY = 'isPublic';
export const STORE_ROLE_KEY = 'storeRole';
export const COMPANY_ROLE_KEY = 'companyRole';
export const COMPANY_ADMIN_KEY = 'companyAdmin';
export const BILLING_OWNER_KEY = 'billingOwner';
export const PLATFORM_ROLE_KEY = 'platformRoles';
export const ALLOW_READ_ONLY_KEY = 'allowWhenReadOnly';

/** Rota sem autenticação. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Papel mínimo na loja da rota (/stores/:storeId/...). Padrão sem o decorator: EMPLOYEE. */
export const StoreRole = (min: Role) => SetMetadata(STORE_ROLE_KEY, min);

/** Papel mínimo em ALGUMA loja da company da rota (/companies/:companyId/...). */
export const CompanyRole = (min: Role) => SetMetadata(COMPANY_ROLE_KEY, min);

/** OWNER da company (OWNER em pelo menos uma loja dela). */
export const CompanyOwner = () => SetMetadata(COMPANY_ROLE_KEY, Role.OWNER);

/**
 * Dono OU gerente geral da company: painel da empresa, equipe e edição de lojas. O que o gerente
 * geral não pode fazer dentro dessas rotas (mexer em donos, dar papel de dono) o service confere.
 */
export const CompanyAdmin = () => SetMetadata(COMPANY_ADMIN_KEY, true);

/** Dono ou gerente geral (a regra do `CompanyAdmin`). */
export function isCompanyAdmin(tenant: CompanyTenant): boolean {
  return tenant.role === Role.OWNER || tenant.isGeneralManager;
}

/** Responsável pela cobrança da organização (/organizations/:organizationId/...). */
export const BillingOwner = () => SetMetadata(BILLING_OWNER_KEY, true);

/** Rota da plataforma: exige um dos papéis informados. */
export const RequirePlatformRole = (...roles: PlatformRole[]) =>
  SetMetadata(PLATFORM_ROLE_KEY, roles);

/** Rota que continua funcionando com a assinatura em somente leitura (lista fechada). */
export const AllowWhenReadOnly = () => SetMetadata(ALLOW_READ_ONLY_KEY, true);

// ---- Decorators de parâmetro -------------------------------------------------------------------

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);

/** Contexto resolvido pelo TenantGuard. Tipar o parâmetro como StoreTenant, CompanyTenant ou OrgTenant. */
export const Tenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().tenant;
  },
);
