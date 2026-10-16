import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditContext } from '../audit/audit-context';
import { paginate, pageArgs } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePlanDto,
  ListOrganizationsQuery,
  ListUsersQuery,
  UpdateOrganizationDto,
  UpdatePlanDto,
} from './dto/platform.dto';

const PLAN_SELECT = {
  id: true,
  name: true,
  priceInCents: true,
  maxCompanies: true,
  maxStoresPerCompany: true,
  createdAt: true,
} satisfies Prisma.PlanSelect;

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  platformRole: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Operação da plataforma (SUPERADMIN escreve, SUPPORT só lê): planos, organizações e usuários. */
@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  // ---- Planos ----------------------------------------------------------------------------------

  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      select: {
        ...PLAN_SELECT,
        _count: { select: { organizations: { where: { deletedAt: null } } } },
      },
      orderBy: { priceInCents: 'asc' },
    });
    return plans.map(({ _count, ...plan }) => ({
      ...plan,
      organizations: _count.organizations,
    }));
  }

  async createPlan(dto: CreatePlanDto) {
    await this.assertPlanNameFree(dto.name);
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        priceInCents: dto.priceInCents,
        maxCompanies: dto.maxCompanies ?? null,
        maxStoresPerCompany: dto.maxStoresPerCompany ?? null,
      },
      select: PLAN_SELECT,
    });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    await this.getPlan(id);
    if (dto.name) await this.assertPlanNameFree(dto.name, id);
    return this.prisma.plan.update({
      where: { id },
      data: dto,
      select: PLAN_SELECT,
    });
  }

  /** Bloqueado enquanto alguma organização ativa usar o plano. */
  async removePlan(id: string) {
    await this.getPlan(id);
    const inUse = await this.prisma.organization.count({
      where: { planId: id },
    });
    if (inUse > 0)
      throw new ConflictException(
        `O plano está em uso por ${inUse} organização(ões).`,
      );
    await this.prisma.plan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Plano excluído.' };
  }

  private async getPlan(id: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id },
      select: PLAN_SELECT,
    });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    return plan;
  }

  private async assertPlanNameFree(name: string, exceptId?: string) {
    const existing = await this.audit.withDeleted(() =>
      this.prisma.plan.findUnique({
        where: { name },
        select: { id: true, deletedAt: true },
      }),
    );
    if (!existing || existing.id === exceptId) return;
    throw new ConflictException(
      existing.deletedAt
        ? `O plano "${name}" existe, mas está excluído.`
        : `Já existe um plano chamado "${name}".`,
    );
  }

  // ---- Organizações -----------------------------------------------------------------------------

  async listOrganizations(query: ListOrganizationsQuery) {
    const where: Prisma.OrganizationWhereInput = {
      ...(query.status ? { subscriptionStatus: query.status } : {}),
      ...(query.planId ? { planId: query.planId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                owner: {
                  email: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          pastDueSince: true,
          createdAt: true,
          plan: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { companies: { where: { deletedAt: null } } } },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.organization.count({ where }),
    ]);
    const data = rows.map(({ _count, ...org }) => ({
      ...org,
      companies: _count.companies,
    }));
    return paginate(data, total, query.page, query.limit);
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        pastDueSince: true,
        billingProvider: true,
        billingMethod: true,
        createdAt: true,
        plan: { select: PLAN_SELECT },
        owner: { select: { id: true, name: true, email: true } },
        companies: {
          where: { deletedAt: null },
          select: {
            id: true,
            cnpj: true,
            razaoSocial: true,
            nomeFantasia: true,
            stores: {
              where: { deletedAt: null },
              select: { id: true, name: true },
            },
          },
          orderBy: { razaoSocial: 'asc' },
        },
      },
    });
    if (!org) throw new NotFoundException('Organização não encontrada.');

    const users = await this.prisma.membership.findMany({
      where: {
        company: { organizationId: id, deletedAt: null },
        stores: { some: { deletedAt: null } },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return { ...org, userCount: users.length };
  }

  /**
   * Ajuste manual da assinatura. Mantém `pastDueSince` coerente: marca o início do atraso ao
   * entrar em PAST_DUE e limpa ao sair dele (a carência é contada a partir dessa data).
   */
  async updateOrganization(id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findFirst({ where: { id } });
    if (!org) throw new NotFoundException('Organização não encontrada.');
    if (dto.planId) {
      const plan = await this.prisma.plan.findFirst({
        where: { id: dto.planId },
      });
      if (!plan) throw new NotFoundException('Plano não encontrado.');
    }

    const data: Prisma.OrganizationUncheckedUpdateInput = {
      ...(dto.planId ? { planId: dto.planId } : {}),
      ...(dto.trialEndsAt !== undefined
        ? { trialEndsAt: dto.trialEndsAt }
        : {}),
    };

    if (dto.subscriptionStatus) {
      data.subscriptionStatus = dto.subscriptionStatus;
      if (dto.pastDueSince === undefined) {
        if (dto.subscriptionStatus === 'PAST_DUE')
          data.pastDueSince = org.pastDueSince ?? new Date();
        else data.pastDueSince = null;
      }
    }
    if (dto.pastDueSince !== undefined) data.pastDueSince = dto.pastDueSince;

    await this.prisma.organization.update({ where: { id }, data });
    return this.getOrganization(id);
  }

  // ---- Usuários ------------------------------------------------------------------------------------

  async listUsers(query: ListUsersQuery) {
    const where: Prisma.UserWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { email: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  /**
   * Ativa ou desativa o usuário em TODA a plataforma. Ao desativar, as sessões dele são encerradas
   * (o guard já bloqueia o access token na hora). Quem administra uma empresa só revoga acesso.
   */
  async setUserActive(actorId: string, id: string, isActive: boolean) {
    if (id === actorId && !isActive)
      throw new ConflictException('Você não pode desativar o próprio usuário.');
    const user = await this.prisma.user.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive } });
      if (!isActive) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });
    return this.prisma.user.findFirstOrThrow({
      where: { id },
      select: USER_SELECT,
    });
  }
}
