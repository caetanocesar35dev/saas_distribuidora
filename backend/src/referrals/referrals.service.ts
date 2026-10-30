import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditContext } from '../audit/audit-context';
import { paginate, pageArgs } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { isReferralCodeTaken } from './referral-rewards';
import {
  buildReferralCode,
  REFERRAL_DISCOUNT_MONTHS,
  REFERRAL_DISCOUNT_PERCENT,
  REFERRAL_MAX_MONTHS,
  remainingMonths,
} from './referral-rules';
import {
  CreateRepresentativeDto,
  ListReferralsQuery,
  UpdateRepresentativeDto,
} from './referrals.dto';

const REPRESENTATIVE_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  pixKey: true,
  code: true,
  commissionPercent: true,
  notes: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.SalesRepresentativeSelect;

const REFERRAL_SELECT = {
  id: true,
  code: true,
  status: true,
  createdAt: true,
  confirmedAt: true,
  canceledAt: true,
  note: true,
  confirmedPlanPriceInCents: true,
  commissionInCents: true,
  commissionPaidAt: true,
  commissionNote: true,
  confirmedPlan: { select: { id: true, name: true } },
  referredOrganization: {
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      plan: { select: { id: true, name: true, priceInCents: true } },
      owner: { select: { name: true, email: true } },
    },
  },
  referrerOrganization: { select: { id: true, name: true } },
  representative: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ReferralSelect;

const RULES = {
  discountPercent: REFERRAL_DISCOUNT_PERCENT,
  discountMonths: REFERRAL_DISCOUNT_MONTHS,
  maxMonths: REFERRAL_MAX_MONTHS,
};

/**
 * Programa de indicação (decisão do usuário, 2026-10-30): a tela "Indique e ganhe" do responsável
 * pela assinatura e, na plataforma, os representantes, as indicações e o painel. As regras de
 * cadastro e confirmação ficam em `referral-rewards.ts`.
 */
@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  // ---- Responsável pela assinatura ---------------------------------------------------------------

  /** Código (criado na primeira vez), indicações feitas e descontos da organização. */
  async forOrganization(organizationId: string) {
    const code = await this.ensureOrganizationCode(organizationId);
    const [made, discounts, referredBy] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerOrganizationId: organizationId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          confirmedAt: true,
          referredOrganization: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscriptionDiscount.findMany({
        where: { organizationId },
        select: {
          id: true,
          reason: true,
          percent: true,
          months: true,
          monthsUsed: true,
          createdAt: true,
          referral: {
            select: {
              referredOrganization: { select: { name: true } },
              referrerOrganization: { select: { name: true } },
              representative: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.referral.findFirst({
        where: { referredOrganizationId: organizationId },
        select: { code: true, status: true, createdAt: true },
      }),
    ]);

    return {
      code,
      rules: RULES,
      remainingMonths: remainingMonths(discounts),
      referredBy,
      referrals: made.map((r) => ({
        id: r.id,
        organizationName: r.referredOrganization.name,
        status: r.status,
        createdAt: r.createdAt,
        confirmedAt: r.confirmedAt,
      })),
      discounts: discounts.map(({ referral, ...d }) => ({
        ...d,
        remaining: Math.max(0, d.months - d.monthsUsed),
        // De onde veio: quem indicou (para quem se cadastrou) ou quem foi indicado (para quem indicou).
        from:
          d.reason === 'REFERRED'
            ? (referral.referrerOrganization?.name ??
              referral.representative?.name ??
              null)
            : referral.referredOrganization.name,
      })),
    };
  }

  private async ensureOrganizationCode(organizationId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { name: true, referralCode: true },
    });
    if (!org) throw new NotFoundException('Organização não encontrada.');
    if (org.referralCode) return org.referralCode;

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = buildReferralCode(org.name);
      if (await isReferralCodeTaken(this.prisma, code)) continue;
      try {
        // Só grava se ainda não tiver código (duas abas abrindo ao mesmo tempo).
        await this.prisma.organization.updateMany({
          where: { id: organizationId, referralCode: null },
          data: { referralCode: code },
        });
      } catch (error) {
        if (isUniqueViolation(error)) continue;
        throw error;
      }
      const saved = await this.prisma.organization.findFirstOrThrow({
        where: { id: organizationId },
        select: { referralCode: true },
      });
      if (saved.referralCode) return saved.referralCode;
    }
    throw new ConflictException(
      'Não foi possível criar o código de indicação. Tente de novo.',
    );
  }

  // ---- Plataforma: representantes ----------------------------------------------------------------

  async listRepresentatives(deleted = false) {
    const reps = await this.audit.withDeleted(() =>
      this.prisma.salesRepresentative.findMany({
        where: { deletedAt: deleted ? { not: null } : null },
        select: {
          ...REPRESENTATIVE_SELECT,
          referrals: {
            select: {
              status: true,
              commissionInCents: true,
              commissionPaidAt: true,
              deletedAt: true,
            },
          },
        },
        orderBy: deleted ? { deletedAt: 'desc' } : { name: 'asc' },
      }),
    );
    return reps.map(({ referrals, ...rep }) => ({
      ...rep,
      ...referralTotals(referrals.filter((r) => r.deletedAt === null)),
    }));
  }

  async createRepresentative(dto: CreateRepresentativeDto) {
    const code = dto.code ?? (await this.freeCode(dto.name));
    if (dto.code) await this.assertCodeFree(dto.code);
    try {
      return await this.prisma.salesRepresentative.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email ?? null,
          pixKey: dto.pixKey,
          code,
          commissionPercent: dto.commissionPercent,
          notes: dto.notes ?? null,
        },
        select: REPRESENTATIVE_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw codeTaken(code);
      throw error;
    }
  }

  /**
   * Mudar a % só vale para as indicações confirmadas depois; mudar o código não mexe nas
   * indicações já feitas (cada uma guarda o código usado).
   */
  async updateRepresentative(id: string, dto: UpdateRepresentativeDto) {
    await this.getRepresentative(id);
    if (dto.code) await this.assertCodeFree(dto.code, id);
    try {
      return await this.prisma.salesRepresentative.update({
        where: { id },
        data: dto,
        select: REPRESENTATIVE_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error) && dto.code) throw codeTaken(dto.code);
      throw error;
    }
  }

  /** O código deixa de valer no cadastro; as indicações e comissões dele continuam na tela. */
  async removeRepresentative(id: string) {
    await this.getRepresentative(id);
    await this.prisma.salesRepresentative.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Representante excluído.' };
  }

  async restoreRepresentative(id: string) {
    const rep = await this.audit.withDeleted(() =>
      this.prisma.salesRepresentative.findFirst({
        where: { id },
        select: { deletedAt: true },
      }),
    );
    if (!rep) throw new NotFoundException('Representante não encontrado.');
    if (!rep.deletedAt)
      throw new ConflictException('O representante não está excluído.');
    await this.audit.withDeleted(() =>
      this.prisma.salesRepresentative.update({
        where: { id },
        data: { deletedAt: null },
      }),
    );
    return this.getRepresentative(id);
  }

  private async getRepresentative(id: string) {
    const rep = await this.prisma.salesRepresentative.findFirst({
      where: { id },
      select: REPRESENTATIVE_SELECT,
    });
    if (!rep) throw new NotFoundException('Representante não encontrado.');
    return rep;
  }

  private async assertCodeFree(code: string, exceptRepresentativeId?: string) {
    if (await isReferralCodeTaken(this.prisma, code, exceptRepresentativeId))
      throw codeTaken(code);
  }

  private async freeCode(name: string) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = buildReferralCode(name);
      if (!(await isReferralCodeTaken(this.prisma, code))) return code;
    }
    throw new ConflictException(
      'Não foi possível criar o código. Informe um código.',
    );
  }

  // ---- Plataforma: indicações --------------------------------------------------------------------

  async listReferrals(query: ListReferralsQuery) {
    const where: Prisma.ReferralWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.source === 'CUSTOMER'
        ? { referrerOrganizationId: { not: null } }
        : query.source === 'REPRESENTATIVE'
          ? { representativeId: { not: null } }
          : {}),
      ...(query.representativeId
        ? { representativeId: query.representativeId }
        : {}),
      ...(query.commission === 'TO_PAY'
        ? {
            status: 'CONFIRMED',
            representativeId: { not: null },
            commissionPaidAt: null,
          }
        : query.commission === 'PAID'
          ? { commissionPaidAt: { not: null } }
          : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              {
                referredOrganization: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                referrerOrganization: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                representative: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        select: REFERRAL_SELECT,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.referral.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  /** Painel da plataforma: totais, quem mais indica, comissões e descontos em uso. */
  async summary() {
    const [referrals, discounts, representatives] = await Promise.all([
      this.prisma.referral.findMany({
        select: {
          status: true,
          commissionInCents: true,
          commissionPaidAt: true,
          referrerOrganization: {
            select: { id: true, name: true, referralCode: true },
          },
          representativeId: true,
        },
      }),
      this.prisma.subscriptionDiscount.findMany({
        select: {
          reason: true,
          percent: true,
          months: true,
          monthsUsed: true,
          organization: {
            select: {
              id: true,
              name: true,
              subscriptionStatus: true,
              plan: { select: { name: true } },
            },
          },
        },
      }),
      this.listRepresentatives(),
    ]);

    const byCustomer = new Map<
      string,
      {
        organizationId: string;
        name: string;
        code: string | null;
        referrals: number;
        confirmed: number;
      }
    >();
    for (const r of referrals) {
      const org = r.referrerOrganization;
      if (!org) continue;
      const row = byCustomer.get(org.id) ?? {
        organizationId: org.id,
        name: org.name,
        code: org.referralCode,
        referrals: 0,
        confirmed: 0,
      };
      if (r.status !== 'CANCELED') row.referrals++;
      if (r.status === 'CONFIRMED') row.confirmed++;
      byCustomer.set(org.id, row);
    }

    const byOrg = new Map<
      string,
      {
        organizationId: string;
        name: string;
        subscriptionStatus: string;
        planName: string;
        percent: number;
        remainingMonths: number;
        usedMonths: number;
        discounts: number;
      }
    >();
    for (const d of discounts) {
      const row = byOrg.get(d.organization.id) ?? {
        organizationId: d.organization.id,
        name: d.organization.name,
        subscriptionStatus: d.organization.subscriptionStatus,
        planName: d.organization.plan.name,
        percent: d.percent,
        remainingMonths: 0,
        usedMonths: 0,
        discounts: 0,
      };
      row.remainingMonths += Math.max(0, d.months - d.monthsUsed);
      row.usedMonths += d.monthsUsed;
      row.discounts++;
      byOrg.set(d.organization.id, row);
    }

    const count = (fn: (r: (typeof referrals)[number]) => boolean) =>
      referrals.filter(fn).length;
    return {
      rules: RULES,
      totals: {
        all: referrals.length,
        pending: count((r) => r.status === 'PENDING'),
        confirmed: count((r) => r.status === 'CONFIRMED'),
        canceled: count((r) => r.status === 'CANCELED'),
        fromCustomers: count((r) => r.referrerOrganization !== null),
        fromRepresentatives: count((r) => r.representativeId !== null),
      },
      commissions: referralTotals(referrals),
      representatives: representatives
        .map(({ id, name, code, commissionPercent, ...totals }) => ({
          id,
          name,
          code,
          commissionPercent,
          referrals: totals.referrals,
          confirmed: totals.confirmed,
          toPayInCents: totals.toPayInCents,
          paidInCents: totals.paidInCents,
        }))
        .sort((a, b) => b.confirmed - a.confirmed || b.referrals - a.referrals),
      topCustomers: [...byCustomer.values()]
        .sort((a, b) => b.confirmed - a.confirmed || b.referrals - a.referrals)
        .slice(0, 10),
      discounts: [...byOrg.values()]
        .filter((d) => d.remainingMonths > 0)
        .sort((a, b) => b.remainingMonths - a.remainingMonths),
    };
  }

  /** "Pix enviado": só indicação de representante, confirmada e ainda não paga. */
  async markCommissionPaid(id: string, note?: string) {
    const referral = await this.prisma.referral.findFirst({
      where: { id },
      select: { status: true, representativeId: true, commissionPaidAt: true },
    });
    if (!referral) throw new NotFoundException('Indicação não encontrada.');
    if (!referral.representativeId)
      throw new ConflictException(
        'Só indicação de representante tem comissão.',
      );
    if (referral.status !== 'CONFIRMED')
      throw new ConflictException(
        'A comissão só vale quando o indicado paga a 1ª mensalidade.',
      );
    if (referral.commissionPaidAt)
      throw new ConflictException('Esta comissão já foi paga.');
    return this.prisma.referral.update({
      where: { id },
      data: { commissionPaidAt: new Date(), commissionNote: note || null },
      select: REFERRAL_SELECT,
    });
  }

  /**
   * Anula a indicação (ex.: conta criada só para ganhar desconto). Os meses de desconto ainda não
   * usados deixam de valer; comissão já paga não pode ser anulada por aqui.
   */
  async cancelReferral(id: string, reason: string) {
    const referral = await this.prisma.referral.findFirst({
      where: { id },
      select: { status: true, commissionPaidAt: true },
    });
    if (!referral) throw new NotFoundException('Indicação não encontrada.');
    if (referral.status === 'CANCELED')
      throw new ConflictException('A indicação já está cancelada.');
    if (referral.commissionPaidAt)
      throw new ConflictException(
        'A comissão desta indicação já foi paga ao representante.',
      );

    return this.prisma.$transaction(async (tx) => {
      const discounts = await tx.subscriptionDiscount.findMany({
        where: { referralId: id },
        select: { id: true, monthsUsed: true },
      });
      for (const d of discounts) {
        await tx.subscriptionDiscount.update({
          where: { id: d.id },
          data:
            d.monthsUsed === 0
              ? { deletedAt: new Date() }
              : { months: d.monthsUsed },
        });
      }
      return tx.referral.update({
        where: { id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
          note: reason,
          commissionInCents: null,
        },
        select: REFERRAL_SELECT,
      });
    });
  }
}

function referralTotals(
  referrals: {
    status: string;
    commissionInCents: number | null;
    commissionPaidAt: Date | null;
  }[],
) {
  let toPayInCents = 0;
  let paidInCents = 0;
  for (const r of referrals) {
    if (r.status !== 'CONFIRMED' || r.commissionInCents === null) continue;
    if (r.commissionPaidAt) paidInCents += r.commissionInCents;
    else toPayInCents += r.commissionInCents;
  }
  return {
    referrals: referrals.filter((r) => r.status !== 'CANCELED').length,
    confirmed: referrals.filter((r) => r.status === 'CONFIRMED').length,
    toPayInCents,
    paidInCents,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function codeTaken(code: string) {
  return new ConflictException(`O código ${code} já está em uso.`);
}
