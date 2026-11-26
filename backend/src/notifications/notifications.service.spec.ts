import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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

    it('marcar todas como lidas: só as visíveis e não lidas, sem mexer na data das já lidas', async () => {
      const a = await publish({ title: 'A' });
      await publish({ title: 'B' });
      await publish({ title: 'C' });
      await publish({ title: 'Futura', publishedAt: at(5) });
      const first = await as(ana.id, () => service.markRead(ana.id, a.id));
      await new Promise((r) => setTimeout(r, 20));

      expect(await as(ana.id, () => service.markAllRead(ana.id))).toEqual({
        marked: 2,
      });
      expect(await service.unreadCount(ana.id)).toEqual({ count: 0 });
      const readA = await ctx.prisma.notificationRead.findFirstOrThrow({
        where: { notificationId: a.id, userId: ana.id },
      });
      expect(readA.readAt.getTime()).toBe(first.readAt.getTime());
      // a agendada continua não lida quando chegar a hora; a Bia não foi afetada
      expect(await service.unreadCount(ana.id, at(6))).toEqual({ count: 1 });
      expect(await service.unreadCount(bia.id)).toEqual({ count: 3 });
      // de novo, sem nada para marcar
      expect(await as(ana.id, () => service.markAllRead(ana.id))).toEqual({
        marked: 0,
      });
    });

    it('marcar todas ao mesmo tempo não duplica nem falha', async () => {
      await publish({ title: 'A' });
      await publish({ title: 'B' });
      const results = await Promise.allSettled(
        Array.from({ length: 3 }, () =>
          as(ana.id, () => service.markAllRead(ana.id)),
        ),
      );
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(await ctx.prisma.notificationRead.count()).toBe(2);
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

  describe('enquete', () => {
    const poll = (
      over: Partial<Parameters<NotificationsService['create']>[1]> = {},
    ) =>
      publish({
        title: 'Qual recurso você quer?',
        type: 'POLL',
        pollOptions: ['Nota fiscal', 'Delivery', 'Relatórios'],
        pollEndsAt: at(24),
        ...over,
      });
    const vote = (
      userId: string,
      id: string,
      optionIds: string[],
      now?: Date,
    ) => as(userId, () => service.vote(userId, id, optionIds, now));
    const pollOf = async (userId: string, id: string, now?: Date) =>
      (await service.listForUser(userId, page, now)).data.find(
        (n) => n.id === id,
      )!.poll!;
    const votesOf = (view: {
      options: { label: string; votes: number | null }[];
    }) => Object.fromEntries(view.options.map((o) => [o.label, o.votes]));

    it('cria com as opções na ordem, o prazo e a escolha única por padrão', async () => {
      const n = await poll();
      expect(n.poll).toMatchObject({
        multiple: false,
        closed: false,
        showResults: true, // a plataforma vê sempre
        totalVoters: 0,
      });
      expect(n.poll!.options.map((o) => o.label)).toEqual([
        'Nota fiscal',
        'Delivery',
        'Relatórios',
      ]);
      const comum = await publish({ title: 'Aviso' });
      expect(comum.poll).toBeNull();
    });

    it('recusa enquete sem opções, sem prazo, com prazo vencido, opções repetidas ou que some antes do prazo', async () => {
      for (const over of [
        { pollOptions: undefined },
        { pollEndsAt: undefined },
        { pollEndsAt: at(-1) },
        { pollOptions: ['Sim', ' sim '] },
        { expiresAt: at(12) },
      ]) {
        await expect(poll(over)).rejects.toBeInstanceOf(BadRequestException);
      }
      // notificação comum não leva opções
      await expect(publish({ pollOptions: ['A', 'B'] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('escolha única: quem votou vê o resultado na hora, quem não votou não; trocar o voto move a contagem', async () => {
      const n = await poll();
      const [nf, delivery] = n.poll!.options;

      const beforeVote = await pollOf(ana.id, n.id);
      expect(beforeVote.showResults).toBe(false);
      expect(beforeVote.totalVoters).toBeNull();
      expect(beforeVote.options.every((o) => o.votes === null)).toBe(true);

      const afterVote = await vote(ana.id, n.id, [nf.id]);
      expect(afterVote).toMatchObject({
        showResults: true,
        totalVoters: 1,
        myOptionIds: [nf.id],
      });
      expect(votesOf(afterVote)).toEqual({
        'Nota fiscal': 1,
        Delivery: 0,
        Relatórios: 0,
      });
      // votar também marca como lida
      expect(await service.unreadCount(ana.id)).toEqual({ count: 0 });
      // a Bia não votou: não vê os números
      expect((await pollOf(bia.id, n.id)).showResults).toBe(false);

      const changed = await vote(ana.id, n.id, [delivery.id]);
      expect(votesOf(changed)).toEqual({
        'Nota fiscal': 0,
        Delivery: 1,
        Relatórios: 0,
      });
      expect(changed.totalVoters).toBe(1);

      // voltar para a primeira opção reativa o voto antigo, sem duplicar
      await vote(ana.id, n.id, [nf.id]);
      expect(
        await ctx.prisma.notificationPollVote.count({
          where: { userId: ana.id },
        }),
      ).toBe(1);
    });

    it('escolha única recusa duas opções e opção de outra enquete', async () => {
      const n = await poll();
      const outra = await poll({ pollOptions: ['X', 'Y'] });
      const [a, b] = n.poll!.options;
      await expect(vote(ana.id, n.id, [a.id, b.id])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        vote(ana.id, n.id, [outra.poll!.options[0].id]),
      ).rejects.toBeInstanceOf(BadRequestException);
      const comum = await publish({ title: 'Aviso' });
      await expect(vote(ana.id, comum.id, [a.id])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('várias respostas: conta cada opção e a pessoa uma vez só', async () => {
      const n = await poll({ pollMultiple: true });
      const [nf, delivery, rel] = n.poll!.options;
      await vote(ana.id, n.id, [nf.id, delivery.id]);
      const view = await vote(bia.id, n.id, [delivery.id, rel.id]);
      expect(view.totalVoters).toBe(2);
      expect(votesOf(view)).toEqual({
        'Nota fiscal': 1,
        Delivery: 2,
        Relatórios: 1,
      });
      // a Ana desmarca a Nota fiscal
      const after = await vote(ana.id, n.id, [delivery.id]);
      expect(votesOf(after)).toEqual({
        'Nota fiscal': 0,
        Delivery: 2,
        Relatórios: 1,
      });
    });

    it('depois do prazo não vota mais, e todos veem o resultado', async () => {
      const n = await poll();
      const [nf] = n.poll!.options;
      await vote(ana.id, n.id, [nf.id]);
      await expect(vote(bia.id, n.id, [nf.id], at(25))).rejects.toBeInstanceOf(
        ConflictException,
      );
      const closed = await pollOf(bia.id, n.id, at(25));
      expect(closed).toMatchObject({
        closed: true,
        showResults: true,
        totalVoters: 1,
      });
    });

    it('votos simultâneos da mesma pessoa deixam um voto só', async () => {
      const n = await poll();
      const results = await Promise.allSettled(
        n.poll!.options.map((o) => vote(ana.id, n.id, [o.id])),
      );
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(
        await ctx.prisma.notificationPollVote.count({
          where: { userId: ana.id, deletedAt: null },
        }),
      ).toBe(1);
    });

    it('editar: opções e tipo de resposta só mudam sem votos; o prazo muda sempre; não vira outro tipo', async () => {
      const n = await poll();
      const edited = await as(admin.id, () =>
        service.update(n.id, {
          pollOptions: ['Sim', 'Não'],
          pollMultiple: true,
        }),
      );
      expect(edited.poll).toMatchObject({ multiple: true });
      expect(edited.poll!.options.map((o) => o.label)).toEqual(['Sim', 'Não']);

      await vote(ana.id, n.id, [edited.poll!.options[0].id]);
      await expect(
        as(admin.id, () =>
          service.update(n.id, { pollOptions: ['Sim', 'Talvez'] }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        as(admin.id, () => service.update(n.id, { pollMultiple: false })),
      ).rejects.toBeInstanceOf(ConflictException);
      // mandar as mesmas opções (formulário inteiro) não conta como mudança
      const deadline = at(48);
      const later = await as(admin.id, () =>
        service.update(n.id, {
          title: 'Novo título',
          pollOptions: ['Sim', 'Não'],
          pollEndsAt: deadline,
        }),
      );
      expect(later.poll!.endsAt.getTime()).toBe(deadline.getTime());
      expect(later.title).toBe('Novo título');
      await expect(
        as(admin.id, () => service.update(n.id, { type: 'NEWS' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('a plataforma vê o resultado parcial na lista, sem saber quem votou', async () => {
      const n = await poll();
      await vote(ana.id, n.id, [n.poll!.options[1].id]);
      const listed = (await service.listAll(page)).data.find(
        (x) => x.id === n.id,
      )!;
      expect(listed.poll!.totalVoters).toBe(1);
      expect(votesOf(listed.poll!)).toEqual({
        'Nota fiscal': 0,
        Delivery: 1,
        Relatórios: 0,
      });
      expect(listed.poll!.myOptionIds).toEqual([]);
      expect(JSON.stringify(listed)).not.toContain(ana.id);
    });
  });
});
