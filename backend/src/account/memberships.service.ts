import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { AuditContext } from '../audit/audit-context';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../prisma/prisma.extension';
import { InviteMemberDto } from './dto/account.dto';

/**
 * Acessos revogados junto com o vínculo: a remoção grava os dois na mesma transação, mas as
 * remoções antigas (e a revogação da última loja) usavam datas separadas por milissegundos.
 */
const REVOKE_WINDOW_MS = 5_000;

function revokedWithMembership(storeRevokedAt: Date, removedAt: Date) {
  const diff = removedAt.getTime() - storeRevokedAt.getTime();
  return diff >= 0 && diff <= REVOKE_WINDOW_MS;
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Membros da empresa com o papel em cada loja (só quem ainda tem acesso a alguma loja). */
  async list(companyId: string) {
    const members = await this.prisma.membership.findMany({
      where: { companyId },
      select: {
        id: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
        stores: {
          where: { deletedAt: null, store: { deletedAt: null } },
          select: {
            storeId: true,
            role: true,
            store: { select: { name: true } },
          },
        },
      },
    });
    return members
      .filter((m) => m.stores.length > 0)
      .map((m) => ({
        membershipId: m.id,
        user: m.user,
        stores: m.stores
          .map((s) => ({
            storeId: s.storeId,
            storeName: s.store.name,
            role: s.role,
          }))
          .sort((a, b) => a.storeName.localeCompare(b.storeName)),
      }))
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  /**
   * Convida por e-mail. Usuário novo é criado com senha inutilizável e recebe um link (7 dias)
   * para definir a senha; usuário existente só ganha o vínculo (ou o reativa).
   */
  async invite(
    companyId: string,
    inviter: { id: string; name: string },
    dto: InviteMemberDto,
  ) {
    const storeIds = dto.stores.map((s) => s.storeId);
    if (new Set(storeIds).size !== storeIds.length) {
      throw new BadRequestException('Cada loja só pode aparecer uma vez.');
    }

    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { razaoSocial: true, nomeFantasia: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');

    const validStores = await this.prisma.store.count({
      where: { companyId, id: { in: storeIds } },
    });
    if (validStores !== storeIds.length)
      throw new BadRequestException('Alguma loja não pertence à empresa.');

    const existing = await this.audit.withDeleted(() =>
      this.prisma.user.findUnique({ where: { email: dto.email } }),
    );
    if (existing?.deletedAt)
      throw new ConflictException(
        'Este e-mail pertence a um usuário removido.',
      );
    const passwordHash = existing
      ? null
      : await this.auth.unusablePasswordHash();

    const { membership, user } = await this.prisma.$transaction(async (tx) => {
      const user =
        existing ??
        (await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash: passwordHash!,
          },
        }));

      // Reativa o vínculo se ele já existiu (a unicidade usuário+empresa é global).
      const membership = await tx.membership.upsert({
        where: { userId_companyId: { userId: user.id, companyId } },
        create: { userId: user.id, companyId },
        update: { deletedAt: null },
      });
      for (const s of dto.stores) {
        await tx.membershipStore.upsert({
          where: {
            membershipId_storeId: {
              membershipId: membership.id,
              storeId: s.storeId,
            },
          },
          create: {
            membershipId: membership.id,
            storeId: s.storeId,
            role: s.role,
          },
          update: { role: s.role, deletedAt: null },
        });
      }
      return { membership, user };
    });

    const companyName = company.nomeFantasia || company.razaoSocial;
    const appUrl = this.config.get('APP_URL', { infer: true });
    const link = existing
      ? `${appUrl}/login`
      : `${appUrl}/redefinir-senha?token=${encodeURIComponent(
          await this.tokens.signPasswordToken(
            { id: user.id, passwordHash: passwordHash! },
            '7d',
          ),
        )}`;
    await this.mail.sendInvite(
      user.email,
      user.name,
      companyName,
      inviter.name,
      link,
    );

    return {
      membershipId: membership.id,
      userId: user.id,
      invitedNewUser: !existing,
    };
  }

  /** Define (cria, altera ou reativa) o papel do membro em uma loja. */
  async setRole(
    companyId: string,
    actorMembershipId: string,
    membershipId: string,
    storeId: string,
    role: Role,
  ) {
    if (membershipId === actorMembershipId) {
      throw new ConflictException('Você não pode alterar o seu próprio papel.');
    }
    await this.assertMembershipAndStore(companyId, membershipId, storeId);

    await this.prisma.$transaction(async (tx) => {
      await tx.membershipStore.upsert({
        where: { membershipId_storeId: { membershipId, storeId } },
        create: { membershipId, storeId, role },
        update: { role, deletedAt: null },
      });
      await this.assertCompanyKeepsOwner(tx, companyId);
    });
    return { message: 'Papel atualizado.' };
  }

  /** Revoga o acesso a uma loja; se era a última, o vínculo com a empresa também é encerrado. */
  async removeFromStore(
    companyId: string,
    membershipId: string,
    storeId: string,
  ) {
    await this.assertMembershipAndStore(companyId, membershipId, storeId);

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const revoked = await tx.membershipStore.updateMany({
        where: { membershipId, storeId },
        data: { deletedAt: now },
      });
      if (revoked.count === 0)
        throw new NotFoundException('O membro não tem acesso a esta loja.');

      const remaining = await tx.membershipStore.count({
        where: { membershipId, store: { deletedAt: null } },
      });
      if (remaining === 0) {
        await tx.membership.update({
          where: { id: membershipId },
          data: { deletedAt: now },
        });
      }
      await this.assertCompanyKeepsOwner(tx, companyId);
    });
    return { message: 'Acesso revogado.' };
  }

  /** Remove o membro da empresa inteira (todas as lojas). */
  async remove(companyId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, companyId },
    });
    if (!membership) throw new NotFoundException('Membro não encontrado.');

    await this.prisma.$transaction(async (tx) => {
      // A mesma data no vínculo e nos acessos: a reativação devolve exatamente estes acessos.
      const now = new Date();
      await tx.membershipStore.updateMany({
        where: { membershipId },
        data: { deletedAt: now },
      });
      await tx.membership.update({
        where: { id: membershipId },
        data: { deletedAt: now },
      });
      await this.assertCompanyKeepsOwner(tx, companyId);
    });
    return { message: 'Membro removido.' };
  }

  /**
   * Pessoas removidas da empresa (as mais recentes primeiro), com as lojas e os papéis que tinham
   * no momento da remoção (só lojas ativas), para o dono ver e reativar.
   */
  async listRemoved(companyId: string) {
    const members = await this.audit.withDeleted(() =>
      this.prisma.membership.findMany({
        where: { companyId, deletedAt: { not: null } },
        select: {
          id: true,
          deletedAt: true,
          user: {
            select: { id: true, name: true, email: true, isActive: true },
          },
          stores: {
            where: { deletedAt: { not: null }, store: { deletedAt: null } },
            select: {
              storeId: true,
              role: true,
              deletedAt: true,
              store: { select: { name: true } },
            },
          },
        },
        orderBy: { deletedAt: 'desc' },
      }),
    );
    return members.map((m) => ({
      membershipId: m.id,
      user: m.user,
      removedAt: m.deletedAt!,
      stores: m.stores
        .filter((s) => revokedWithMembership(s.deletedAt!, m.deletedAt!))
        .map((s) => ({
          storeId: s.storeId,
          storeName: s.store.name,
          role: s.role,
        }))
        .sort((a, b) => a.storeName.localeCompare(b.storeName)),
    }));
  }

  /**
   * Reativa uma pessoa removida com os acessos que ela tinha quando saiu (as lojas revogadas junto
   * com o vínculo). Lojas revogadas antes, uma a uma, não voltam. Se todas essas lojas foram
   * excluídas, não há o que reativar: o dono convida de novo.
   */
  async restore(companyId: string, membershipId: string) {
    const membership = await this.audit.withDeleted(() =>
      this.prisma.membership.findFirst({
        where: { id: membershipId, companyId },
        select: { deletedAt: true },
      }),
    );
    if (!membership) throw new NotFoundException('Membro não encontrado.');
    const removedAt = membership.deletedAt;
    if (!removedAt)
      throw new ConflictException('A pessoa já faz parte da equipe.');

    await this.audit.withDeleted(() =>
      this.prisma.$transaction(async (tx) => {
        const restored = await tx.membershipStore.updateMany({
          where: {
            membershipId,
            deletedAt: {
              gte: new Date(removedAt.getTime() - REVOKE_WINDOW_MS),
              lte: removedAt,
            },
            store: { deletedAt: null },
          },
          data: { deletedAt: null },
        });
        if (restored.count === 0) {
          throw new ConflictException(
            'As lojas que esta pessoa acessava foram excluídas. Convide-a de novo, escolhendo as lojas.',
          );
        }
        await tx.membership.update({
          where: { id: membershipId },
          data: { deletedAt: null },
        });
      }),
    );
    return { message: 'Pessoa reativada na equipe.' };
  }

  private async assertMembershipAndStore(
    companyId: string,
    membershipId: string,
    storeId: string,
  ) {
    const [membership, store] = await Promise.all([
      this.prisma.membership.findFirst({
        where: { id: membershipId, companyId },
      }),
      this.prisma.store.findFirst({ where: { id: storeId, companyId } }),
    ]);
    if (!membership) throw new NotFoundException('Membro não encontrado.');
    if (!store) throw new NotFoundException('Loja não encontrada.');
  }

  /** Depois de qualquer alteração, a empresa precisa continuar com pelo menos um OWNER. */
  private async assertCompanyKeepsOwner(tx: PrismaTx, companyId: string) {
    const owners = await tx.membershipStore.count({
      where: {
        role: 'OWNER',
        store: { deletedAt: null, companyId },
        membership: { deletedAt: null, companyId },
      },
    });
    if (owners === 0) {
      throw new ConflictException(
        'A empresa precisa ter pelo menos um dono (OWNER).',
      );
    }
  }
}
