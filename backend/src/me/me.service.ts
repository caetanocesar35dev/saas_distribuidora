import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { UpdateProfileDto } from '../auth/dto/auth.dto';
import {
  resolveAccessMode,
  SubscriptionAccess,
} from '../common/utils/access-mode';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface MembershipView {
  companyId: string;
  companyName: string;
  organizationId: string;
  isCompanyOwner: boolean;
  isBillingOwner: boolean;
  subscription: SubscriptionAccess;
  stores: { storeId: string; storeName: string; role: Role }[];
}

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  platformRole: true,
  createdAt: true,
} as const;

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: PROFILE_SELECT,
    });
  }

  /**
   * Contrato usado pelo frontend para montar o seletor de empresa/loja: cada company a que o
   * usuário tem acesso, com o papel dele em cada loja e o estado da assinatura.
   */
  async memberships(userId: string): Promise<MembershipView[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, company: { deletedAt: null } },
      select: {
        company: {
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
            organization: {
              select: {
                id: true,
                ownerUserId: true,
                subscriptionStatus: true,
                trialEndsAt: true,
                pastDueSince: true,
              },
            },
          },
        },
        stores: {
          where: { deletedAt: null, store: { deletedAt: null } },
          select: { role: true, store: { select: { id: true, name: true } } },
        },
      },
    });

    const graceDays = this.config.get('SUBSCRIPTION_GRACE_DAYS', {
      infer: true,
    });
    const now = new Date();

    return rows
      .filter((m) => m.stores.length > 0)
      .map((m) => {
        const org = m.company.organization;
        return {
          companyId: m.company.id,
          companyName: m.company.nomeFantasia || m.company.razaoSocial,
          organizationId: org.id,
          isCompanyOwner: m.stores.some((s) => s.role === 'OWNER'),
          isBillingOwner: org.ownerUserId === userId,
          subscription: resolveAccessMode(org, now, graceDays),
          stores: m.stores
            .map((s) => ({
              storeId: s.store.id,
              storeName: s.store.name,
              role: s.role,
            }))
            .sort((a, b) => a.storeName.localeCompare(b.storeName)),
        };
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }
}
