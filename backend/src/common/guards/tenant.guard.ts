import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Role, SubscriptionStatus } from '@prisma/client';
import { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BILLING_OWNER_KEY,
  COMPANY_ROLE_KEY,
  CompanyTenant,
  IS_PUBLIC_KEY,
  OrgTenant,
  PLATFORM_ROLE_KEY,
  STORE_ROLE_KEY,
  StoreTenant,
  hasMinRole,
  maxRole,
} from '../decorators/access.decorators';
import { resolveAccessMode } from '../utils/access-mode';

interface OrgRow {
  id: string;
  ownerUserId: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  pastDueSince: Date | null;
}

const ORG_SELECT = {
  id: true,
  ownerUserId: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  pastDueSince: true,
} as const;

/**
 * Isolamento de tenant. Resolve o contexto SOMENTE pelos params da rota (storeId, companyId,
 * organizationId) e confere se o usuário tem acesso:
 *  - sem acesso -> 404 (nunca revela que o recurso existe)
 *  - acesso com papel insuficiente -> 403
 * Anexa `request.tenant` (StoreTenant, CompanyTenant ou OrgTenant).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;
    // Rotas da plataforma (/platform/*) não são de tenant: quem as protege é o PlatformGuard.
    if (this.reflector.getAllAndOverride(PLATFORM_ROLE_KEY, targets))
      return true;

    const request = context.switchToHttp().getRequest();
    const { storeId, companyId, organizationId } = request.params ?? {};
    if (!storeId && !companyId && !organizationId) return true;

    const userId: string = request.user.id;

    if (storeId) {
      const min =
        this.reflector.getAllAndOverride<Role>(STORE_ROLE_KEY, targets) ??
        Role.EMPLOYEE;
      request.tenant = await this.resolveStore(userId, storeId, min);
    } else if (companyId) {
      const min =
        this.reflector.getAllAndOverride<Role>(COMPANY_ROLE_KEY, targets) ??
        Role.EMPLOYEE;
      request.tenant = await this.resolveCompany(userId, companyId, min);
    } else {
      const billingOwnerOnly = !!this.reflector.getAllAndOverride<boolean>(
        BILLING_OWNER_KEY,
        targets,
      );
      request.tenant = await this.resolveOrganization(
        userId,
        organizationId,
        billingOwnerOnly,
      );
    }
    return true;
  }

  private subscription(org: OrgRow) {
    return resolveAccessMode(
      {
        subscriptionStatus: org.subscriptionStatus,
        trialEndsAt: org.trialEndsAt,
        pastDueSince: org.pastDueSince,
      },
      new Date(),
      this.config.get('SUBSCRIPTION_GRACE_DAYS', { infer: true }),
    );
  }

  private async resolveStore(
    userId: string,
    storeId: string,
    min: Role,
  ): Promise<StoreTenant> {
    const access = await this.prisma.membershipStore.findFirst({
      where: {
        storeId,
        store: { deletedAt: null },
        membership: { userId, deletedAt: null, company: { deletedAt: null } },
      },
      select: {
        role: true,
        membershipId: true,
        store: {
          select: {
            companyId: true,
            company: { select: { organization: { select: ORG_SELECT } } },
          },
        },
      },
    });
    if (!access) throw new NotFoundException('Recurso não encontrado.');
    if (!hasMinRole(access.role, min)) {
      throw new ForbiddenException(
        'Seu papel nesta loja não permite esta ação.',
      );
    }

    const org = access.store.company.organization;
    const companyId = access.store.companyId;
    const stores = await this.prisma.membershipStore.findMany({
      where: {
        membershipId: access.membershipId,
        store: { deletedAt: null, companyId },
      },
      select: { storeId: true },
    });

    return {
      organizationId: org.id,
      isBillingOwner: org.ownerUserId === userId,
      subscription: this.subscription(org),
      companyId,
      role: access.role,
      membershipId: access.membershipId,
      storeIds: stores.map((s) => s.storeId),
      storeId,
    };
  }

  private async resolveCompany(
    userId: string,
    companyId: string,
    min: Role,
  ): Promise<CompanyTenant> {
    const rows = await this.prisma.membershipStore.findMany({
      where: {
        store: { deletedAt: null, companyId },
        membership: {
          userId,
          companyId,
          deletedAt: null,
          company: { deletedAt: null },
        },
      },
      select: {
        role: true,
        storeId: true,
        membershipId: true,
        membership: {
          select: {
            company: { select: { organization: { select: ORG_SELECT } } },
          },
        },
      },
    });
    if (rows.length === 0)
      throw new NotFoundException('Recurso não encontrado.');

    const role = maxRole(rows.map((r) => r.role));
    if (!hasMinRole(role, min)) {
      throw new ForbiddenException(
        'Seu papel nesta empresa não permite esta ação.',
      );
    }

    const org = rows[0].membership.company.organization;
    return {
      organizationId: org.id,
      isBillingOwner: org.ownerUserId === userId,
      subscription: this.subscription(org),
      companyId,
      role,
      membershipId: rows[0].membershipId,
      storeIds: rows.map((r) => r.storeId),
    };
  }

  private async resolveOrganization(
    userId: string,
    organizationId: string,
    billingOwnerOnly: boolean,
  ): Promise<OrgTenant> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: ORG_SELECT,
    });
    if (!org) throw new NotFoundException('Recurso não encontrado.');

    const isBillingOwner = org.ownerUserId === userId;
    if (!isBillingOwner) {
      // Quem não é o responsável só enxerga a organização se for membro de alguma company dela.
      const member = await this.prisma.membershipStore.findFirst({
        where: {
          membership: {
            userId,
            deletedAt: null,
            company: { organizationId, deletedAt: null },
          },
          store: { deletedAt: null },
        },
        select: { membershipId: true },
      });
      if (!member) throw new NotFoundException('Recurso não encontrado.');
      if (billingOwnerOnly) {
        throw new ForbiddenException(
          'Apenas o responsável pela cobrança pode fazer isto.',
        );
      }
    }

    return {
      organizationId,
      isBillingOwner,
      subscription: this.subscription(org),
    };
  }
}
