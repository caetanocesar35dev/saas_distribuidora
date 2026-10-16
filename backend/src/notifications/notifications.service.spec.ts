import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let ctx: ServiceTestContext;
  let service: NotificationsService;
  let admin: { id: string };
  let ana: { id: string };
  let bia: { id: string };

  beforeAll(async () => {
    ctx = await createServiceTest([NotificationsService]);
    service = ctx.module.get(NotificationsService);
  });
  beforeEach(async () => {
    await ctx.reset();
    admin = await ctx.factory.user({ platformRole: 'SUPERADMIN' });
    ana = await ctx.factory.user();
    bia = await ctx.factory.user();
  });
  afterAll(() => ctx.close());

  const as = <T>(userId: string, fn: () => Promise<T>) =>
    ctx.asRequest(fn, { userId, endpoint: 'POST /api/teste' });
  const page = { page: 1, limit: 20 };
  const at = (hours: number) => new Date(Date.now() + hours * 3_600_000);
  const publish = (
    over: Partial<Parameters<NotificationsService['create']>[1]> = {},
  ) =>
    as(admin.id, () =>
      service.create(admin.id, { title: 'Aviso', body: 'Texto', ...over }),
    );

  describe('plataforma', () => {
    it('cria com tipo padrão NEWS, publicada agora e sem expirar', async () => {
      const n = await publish();
      expect(n).toMatchObject({
        title: 'Aviso',
        type: 'NEWS',
        expiresAt: null,
      });
      expect(n.publishedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('a expiração precisa ser depois da publicação', async () => {
      await expect(
        publish({ publishedAt: at(5), expiresAt: at(1) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(publish({ expiresAt: at(-1) })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('edita, e ao editar valida as datas contra as atuais', async () => {
      const n = await publish({ expiresAt: at(10) });
      const updated = await as(admin.id, () =>
        service.update(n.id, { title: 'Novo título', type: 'ALERT' }),
      );
      expect(updated).toMatchObject({ title: 'Novo título', type: 'ALERT' });
      await expect(
        as(admin.id, () => service.update(n.id, { expiresAt: at(-5) })),
      ).rejects.toBeInstanceOf(BadRequestException);
      const noExpiry = await as(admin.id, () =>
        service.update(n.id, { expiresAt: null }),
      );
      expect(noExpiry.expiresAt).toBeNull();
      await expect(
        as(admin.id, () => service.update('nao-existe', { title: 'x' })),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lista todas (inclusive agendadas e expiradas) com a quantidade de leituras e o autor', async () => {
      const a = await publish({ title: 'Ativa' });
      await publish({ title: 'Agendada', publishedAt: at(48) });
      await as(ana.id, () => service.markRead(ana.id, a.id));
      const all = await service.listAll(page);
      expect(all.meta.totalItems).toBe(2);
      const ativa = all.data.find((n) => n.title === 'Ativa')!;
      expect(ativa.readCount).toBe(1);
      expect(ativa.createdBy.id).toBe(admin.id);
    });

    it('excluir (soft delete) some para todos', async () => {
      const n = await publish();
      await as(admin.id, () => service.remove(n.id));
      expect((await service.listForUser(ana.id, page)).data).toHaveLength(0);
      expect((await service.listAll(page)).data).toHaveLength(0);
      await expect(
        as(admin.id, () => service.remove(n.id)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('usuário', () => {
    it('vê só o que já foi publicado e ainda não expirou; a agendada aparece quando chega a hora', async () => {
      await publish({ title: 'Agora' });
      await publish({ title: 'Futura', publishedAt: at(24) });
      await publish({
        title: 'Vencida',
        publishedAt: at(-48),
        expiresAt: at(-24),
      });
      await publish({ title: 'Expira depois', expiresAt: at(24) });

      const titles = async (now?: Date) =>
        (await service.listForUser(ana.id, page, now)).data
          .map((n) => n.title)
          .sort();
      expect(await titles()).toEqual(['Agora', 'Expira depois']);
      expect(await titles(at(25))).toEqual(['Agora', 'Futura']); // a futura chegou, a outra expirou
    });

    it('mostra a marca de lida por usuário, e o filtro unread só traz as não lidas', async () => {
      const a = await publish({ title: 'A' });
      await publish({ title: 'B' });
      await as(ana.id, () => service.markRead(ana.id, a.id));

      const forAna = (await service.listForUser(ana.id, page)).data;
      expect(Object.fromEntries(forAna.map((n) => [n.title, n.read]))).toEqual({
        A: true,
        B: false,
      });
      expect(forAna.find((n) => n.title === 'A')!.readAt).toBeInstanceOf(Date);

      expect(
        (await service.listForUser(ana.id, { ...page, unread: true })).data.map(
          (n) => n.title,
        ),
      ).toEqual(['B']);
      // para a Bia, nada foi lido
      expect(
        (await service.listForUser(bia.id, { ...page, unread: true })).data,
      ).toHaveLength(2);
    });

    it('contador de não lidas', async () => {
      const a = await publish({ title: 'A' });
      await publish({ title: 'B' });
      await publish({ title: 'Futura', publishedAt: at(5) });
      expect(await service.unreadCount(ana.id)).toEqual({ count: 2 });
      await as(ana.id, () => service.markRead(ana.id, a.id));
      expect(await service.unreadCount(ana.id)).toEqual({ count: 1 });
      expect(await service.unreadCount(bia.id)).toEqual({ count: 2 });
    });

    it('marcar como lida é idempotente: a data da primeira leitura não muda', async () => {
      const n = await publish();
      const first = await as(ana.id, () => service.markRead(ana.id, n.id));
      await new Promise((r) => setTimeout(r, 20));
      const second = await as(ana.id, () => service.markRead(ana.id, n.id));
      expect(second.readAt.getTime()).toBe(first.readAt.getTime());
      expect(await ctx.prisma.notificationRead.count()).toBe(1);
    });

    it('marcações simultâneas não duplicam nem falham', async () => {
      const n = await publish();
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          as(ana.id, () => service.markRead(ana.id, n.id)),
        ),
      );
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(await ctx.prisma.notificationRead.count()).toBe(1);
    });

    it('não marca notificação inexistente, agendada, expirada ou excluída', async () => {
      const future = await publish({ publishedAt: at(10) });
      const expired = await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.notification.create({
          data: {
            title: 'x',
            body: 'y',
            createdByUserId: admin.id,
            publishedAt: at(-10),
            expiresAt: at(-5),
          },
        }),
      );
      for (const id of [future.id, expired.id, 'nao-existe']) {
        await expect(
          as(ana.id, () => service.markRead(ana.id, id)),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
    });

    it('a leitura fica registrada com o autor (o próprio usuário)', async () => {
      const n = await publish();
      await ctx.asRequest(() => service.markRead(ana.id, n.id), {
        userId: ana.id,
        endpoint: 'POST /api/me/notifications/:id/read',
      });
      const read = await ctx.prisma.notificationRead.findFirstOrThrow();
      expect(read).toMatchObject({
        userId: ana.id,
        modifierId: ana.id,
        modifiedEndpoint: 'POST /api/me/notifications/:id/read',
      });
    });
  });
});
