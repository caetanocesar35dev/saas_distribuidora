import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { RefreshTokenCleanupJob } from './refresh-token-cleanup.job';
import { SubscriptionRemindersJob } from './subscription-reminders.job';

// "Agora" fixo: 14/10/2026 12:00 em São Paulo (15:00 UTC). Carência padrão: 5 dias.
const NOW = new Date('2026-10-14T15:00:00Z');
const at = (iso: string) => new Date(iso);

describe('Jobs agendados', () => {
  let ctx: ServiceTestContext;
  let reminders: SubscriptionRemindersJob;
  let cleanup: RefreshTokenCleanupJob;

  beforeAll(async () => {
    ctx = await createServiceTest([
      SubscriptionRemindersJob,
      RefreshTokenCleanupJob,
    ]);
    reminders = ctx.module.get(SubscriptionRemindersJob);
    cleanup = ctx.module.get(RefreshTokenCleanupJob);
  });
  beforeEach(() => ctx.reset());
  afterAll(() => ctx.close());

  describe('lembretes de assinatura', () => {
    const org = async (
      data: Parameters<typeof ctx.factory.organization>[2],
    ) => {
      const owner = await ctx.factory.user();
      const plan = await ctx.factory.plan();
      const o = await ctx.factory.organization(owner.id, plan.id, data);
      return { owner, org: o };
    };

    it('teste acabando em 3 dias e em 1 dia (por DIA no fuso de São Paulo, não por horas)', async () => {
      const in3 = await org({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: at('2026-10-17T20:00:00Z'),
      }); // 17/10 17:00 SP
      const in1 = await org({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: at('2026-10-15T03:30:00Z'),
      }); // 15/10 00:30 SP
      await org({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: at('2026-10-16T15:00:00Z'),
      }); // em 2 dias: não avisa
      await org({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: at('2026-10-21T15:00:00Z'),
      }); // longe: não avisa

      const found = await reminders.findReminders(NOW);
      expect(found.map((r) => [r.organizationId, r.kind]).sort()).toEqual(
        [
          [in3.org.id, 'TRIAL_3_DAYS'],
          [in1.org.id, 'TRIAL_1_DAY'],
        ].sort(),
      );
      expect(found.find((r) => r.organizationId === in3.org.id)!.to).toBe(
        in3.owner.email,
      );
    });

    it('carência que acaba amanhã (início do atraso + 5 dias cai amanhã)', async () => {
      const ending = await org({
        subscriptionStatus: 'PAST_DUE',
        pastDueSince: at('2026-10-10T18:00:00Z'),
      }); // 10/10 + 5 = 15/10
      await org({
        subscriptionStatus: 'PAST_DUE',
        pastDueSince: at('2026-10-12T18:00:00Z'),
      }); // acaba dia 17
      await org({
        subscriptionStatus: 'PAST_DUE',
        pastDueSince: at('2026-10-05T18:00:00Z'),
      }); // já acabou

      const found = await reminders.findReminders(NOW);
      expect(found).toEqual([
        expect.objectContaining({
          organizationId: ending.org.id,
          kind: 'GRACE_ENDS_TOMORROW',
        }),
      ]);
    });

    it('ignora assinaturas ativas e canceladas, teste já vencido e responsável desativado', async () => {
      await org({ subscriptionStatus: 'ACTIVE' });
      await org({ subscriptionStatus: 'CANCELED' });
      await org({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: at('2026-10-13T15:00:00Z'),
      }); // venceu ontem
      const inactive = await org({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: at('2026-10-15T15:00:00Z'),
      });
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.user.update({
          where: { id: inactive.owner.id },
          data: { isActive: false },
        }),
      );
      expect(await reminders.findReminders(NOW)).toEqual([]);
    });

    it('envia um e-mail por lembrete e conta os enviados', async () => {
      await org({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: at('2026-10-15T15:00:00Z'),
      });
      await org({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: at('2026-10-17T15:00:00Z'),
      });
      const result = await ctx.audit.runAsSystem(
        'job:subscription-reminders',
        () => reminders.run(NOW),
      );
      expect(result.sent).toBe(2);
      expect(ctx.mail.sent.map((m) => m.subject).sort()).toEqual([
        'Seu período de teste termina amanhã',
        'Seu período de teste termina em 3 dias',
      ]);
    });

    it('não muda o status de ninguém: o modo somente leitura é calculado na hora', async () => {
      const o = await org({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: at('2026-10-15T15:00:00Z'),
      });
      await reminders.run(NOW);
      const after = await ctx.prisma.organization.findUniqueOrThrow({
        where: { id: o.org.id },
      });
      expect(after.subscriptionStatus).toBe('TRIAL');
      expect(
        await ctx.prisma.organizationHistory.count({ where: { id: o.org.id } }),
      ).toBe(1);
    });

    it('o handle agendado nunca lança erro (falha só vai para o log)', async () => {
      jest
        .spyOn(reminders, 'run')
        .mockRejectedValueOnce(new Error('banco fora'));
      await expect(reminders.handle()).resolves.toBeUndefined();
    });
  });

  describe('limpeza de refresh tokens', () => {
    const token = (hash: string, expiresAt: Date, revokedAt?: Date) =>
      ctx.audit.runAsSystem('seed', async () => {
        const user = await ctx.prisma.user.findFirst();
        return ctx.prisma.refreshToken.create({
          data: {
            userId: user!.id,
            familyId: 'f',
            tokenHash: hash,
            expiresAt,
            revokedAt,
          },
        });
      });

    it('remove só os expirados há mais de 1 dia; os revogados ainda válidos ficam (detecção de reuso)', async () => {
      await ctx.factory.user();
      const old = await token('old', at('2026-10-10T00:00:00Z'));
      const justExpired = await token('just', at('2026-10-14T00:00:00Z')); // expirou há 15h: ainda não
      const active = await token('active', at('2026-11-10T00:00:00Z'));
      const revokedButValid = await token(
        'revoked',
        at('2026-11-10T00:00:00Z'),
        at('2026-10-01T00:00:00Z'),
      );

      const result = await ctx.audit.runAsSystem(
        'job:refresh-token-cleanup',
        () => cleanup.run(NOW),
      );
      expect(result.removed).toBe(1);

      const remaining = (await ctx.prisma.refreshToken.findMany())
        .map((t) => t.id)
        .sort();
      expect(remaining).toEqual(
        [justExpired.id, active.id, revokedButValid.id].sort(),
      );
      const removed = await ctx.audit.withDeleted(() =>
        ctx.prisma.refreshToken.findUniqueOrThrow({ where: { id: old.id } }),
      );
      expect(removed.deletedAt).not.toBeNull();
    });

    it('rodar de novo não remove nada a mais', async () => {
      await ctx.factory.user();
      await token('old', at('2026-10-10T00:00:00Z'));
      await ctx.audit.runAsSystem('job:refresh-token-cleanup', () =>
        cleanup.run(NOW),
      );
      expect(
        (
          await ctx.audit.runAsSystem('job:refresh-token-cleanup', () =>
            cleanup.run(NOW),
          )
        ).removed,
      ).toBe(0);
    });

    it('o histórico registra que foi o job (origem exata)', async () => {
      await ctx.factory.user();
      const t = await token('old', at('2026-10-10T00:00:00Z'));
      await ctx.audit.runAsSystem('job:refresh-token-cleanup', () =>
        cleanup.run(NOW),
      );
      const history = await ctx.prisma.refreshTokenHistory.findMany({
        where: { id: t.id },
        orderBy: { historyStart: 'asc' },
      });
      expect(history.at(-1)).toMatchObject({
        modifierId: 'system',
        modifiedEndpoint: 'job:refresh-token-cleanup',
      });
    });
  });
});
