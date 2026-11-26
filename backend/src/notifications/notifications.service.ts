import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import {
  paginate,
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { PrismaTx } from '../prisma/prisma.extension';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNotificationDto,
  ListMyNotificationsQuery,
  UpdateNotificationDto,
} from './notifications.dto';
import {
  buildPollView,
  hasDuplicateOptions,
  PollView,
  samePollOptions,
} from './poll';

const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  body: true,
  type: true,
  publishedAt: true,
  expiresAt: true,
  pollEndsAt: true,
  pollMultiple: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

/** Opções ativas da enquete, na ordem de exibição (leitura aninhada não filtra deletedAt sozinha). */
const POLL_OPTIONS = {
  where: { deletedAt: null },
  orderBy: { position: 'asc' },
  select: { id: true, label: true },
} satisfies Prisma.Notification$pollOptionsArgs;

type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof NOTIFICATION_SELECT & { pollOptions: typeof POLL_OPTIONS };
}>;

/** Publicada (data de publicação já chegou) e ainda não expirada. */
const visibleAt = (now: Date): Prisma.NotificationWhereInput => ({
  publishedAt: { lte: now },
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

const POLL_ONLY_FIELDS =
  'Opções, prazo para votar e várias respostas só valem para enquete.';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Plataforma (SUPERADMIN) --------------------------------------------------------------------

  async listAll(query: PaginationQueryDto, now = new Date()) {
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        select: {
          ...NOTIFICATION_SELECT,
          pollOptions: POLL_OPTIONS,
          createdBy: { select: { id: true, name: true } },
          _count: { select: { reads: { where: { deletedAt: null } } } },
        },
        orderBy: { publishedAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.notification.count(),
    ]);
    const polls = await this.pollViews(rows, now, { platform: true });
    return paginate(
      rows.map(({ _count, ...n }) => ({
        ...this.publicFields(n),
        readCount: _count.reads,
        poll: polls.get(n.id) ?? null,
      })),
      total,
      query.page,
      query.limit,
    );
  }

  async create(userId: string, dto: CreateNotificationDto, now = new Date()) {
    const type = dto.type ?? NotificationType.NEWS;
    const publishedAt = dto.publishedAt ?? now;
    this.assertDates(publishedAt, dto.expiresAt);
    let options: string[] | null = null;
    if (type === NotificationType.POLL) {
      if (!dto.pollOptions)
        throw new BadRequestException('Informe as opções da enquete.');
      this.assertPollOptions(dto.pollOptions);
      this.assertPollDates(dto.pollEndsAt, publishedAt, dto.expiresAt);
      if (dto.pollEndsAt!.getTime() <= now.getTime())
        throw new BadRequestException(
          'O prazo para votar precisa ser no futuro.',
        );
      options = dto.pollOptions;
    } else if (this.hasPollFields(dto)) {
      throw new BadRequestException(POLL_ONLY_FIELDS);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          title: dto.title,
          body: dto.body,
          type,
          publishedAt: dto.publishedAt,
          expiresAt: dto.expiresAt ?? null,
          pollEndsAt: options ? dto.pollEndsAt : null,
          pollMultiple: options ? (dto.pollMultiple ?? false) : false,
          createdByUserId: userId,
        },
        select: { id: true },
      });
      if (options) await this.createOptions(tx, notification.id, options);
      return notification;
    });
    return this.findForPlatform(created.id, now);
  }

  async update(id: string, dto: UpdateNotificationDto, now = new Date()) {
    const current = await this.prisma.notification.findFirst({
      where: { id },
      select: { ...NOTIFICATION_SELECT, pollOptions: POLL_OPTIONS },
    });
    if (!current) throw new NotFoundException('Notificação não encontrada.');

    const type = dto.type ?? current.type;
    const isPoll = current.type === NotificationType.POLL;
    if ((type === NotificationType.POLL) !== isPoll)
      throw new BadRequestException(
        'Uma enquete não vira outro tipo de notificação, nem o contrário. Crie uma notificação nova.',
      );
    const publishedAt = dto.publishedAt ?? current.publishedAt;
    const expiresAt =
      dto.expiresAt === undefined ? current.expiresAt : dto.expiresAt;
    this.assertDates(publishedAt, expiresAt);

    let newOptions: string[] | null = null;
    if (isPoll) {
      this.assertPollDates(
        dto.pollEndsAt ?? current.pollEndsAt,
        publishedAt,
        expiresAt,
      );
      const optionsChanged =
        dto.pollOptions !== undefined &&
        !samePollOptions(
          dto.pollOptions,
          current.pollOptions.map((o) => o.label),
        );
      const multipleChanged =
        dto.pollMultiple !== undefined &&
        dto.pollMultiple !== current.pollMultiple;
      if (optionsChanged) {
        this.assertPollOptions(dto.pollOptions!);
        newOptions = dto.pollOptions!;
      }
      if (optionsChanged || multipleChanged) {
        const votes = await this.prisma.notificationPollVote.count({
          where: { notificationId: id },
        });
        if (votes > 0)
          throw new ConflictException(
            'A enquete já recebeu votos: as opções e o tipo de resposta não podem mais mudar.',
          );
      }
    } else if (this.hasPollFields(dto)) {
      throw new BadRequestException(POLL_ONLY_FIELDS);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.notification.update({
        where: { id },
        data: {
          title: dto.title,
          body: dto.body,
          type: dto.type,
          publishedAt: dto.publishedAt,
          expiresAt: dto.expiresAt,
          pollEndsAt: isPoll ? dto.pollEndsAt : undefined,
          pollMultiple: isPoll ? dto.pollMultiple : undefined,
        },
      });
      if (newOptions) {
        await tx.notificationPollOption.updateMany({
          where: { notificationId: id },
          data: { deletedAt: now },
        });
        await this.createOptions(tx, id, newOptions);
      }
    });
    return this.findForPlatform(id, now);
  }

  async remove(id: string) {
    const current = await this.prisma.notification.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Notificação não encontrada.');
    await this.prisma.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Notificação excluída.' };
  }

  private async findForPlatform(id: string, now: Date) {
    const row = await this.prisma.notification.findFirstOrThrow({
      where: { id },
      select: { ...NOTIFICATION_SELECT, pollOptions: POLL_OPTIONS },
    });
    const polls = await this.pollViews([row], now, { platform: true });
    return { ...this.publicFields(row), poll: polls.get(row.id) ?? null };
  }

  private async createOptions(
    tx: PrismaTx,
    notificationId: string,
    labels: string[],
  ) {
    await tx.notificationPollOption.createMany({
      data: labels.map((label, position) => ({
        notificationId,
        label,
        position,
      })),
    });
  }

  private hasPollFields(dto: UpdateNotificationDto) {
    return (
      dto.pollOptions !== undefined ||
      dto.pollEndsAt !== undefined ||
      dto.pollMultiple !== undefined
    );
  }

  private assertDates(publishedAt: Date, expiresAt?: Date | null) {
    if (expiresAt && expiresAt.getTime() <= publishedAt.getTime()) {
      throw new BadRequestException(
        'A data de expiração precisa ser depois da data de publicação.',
      );
    }
  }

  private assertPollOptions(options: string[]) {
    if (hasDuplicateOptions(options))
      throw new BadRequestException(
        'As opções da enquete não podem se repetir.',
      );
  }

  private assertPollDates(
    endsAt: Date | null | undefined,
    publishedAt: Date,
    expiresAt: Date | null | undefined,
  ) {
    if (!endsAt)
      throw new BadRequestException('Informe o prazo para votar na enquete.');
    if (endsAt.getTime() <= publishedAt.getTime())
      throw new BadRequestException(
        'O prazo para votar precisa ser depois da publicação.',
      );
    if (expiresAt && expiresAt.getTime() < endsAt.getTime())
      throw new BadRequestException(
        'A enquete não pode expirar antes do fim do prazo para votar.',
      );
  }

  // ---- Usuário ----------------------------------------------------------------------------------------

  /** Notificações publicadas e não expiradas, com a marca de lida. `unread` filtra as não lidas. */
  async listForUser(
    userId: string,
    query: ListMyNotificationsQuery,
    now = new Date(),
  ) {
    const where: Prisma.NotificationWhereInput = {
      ...visibleAt(now),
      ...(query.unread ? { reads: { none: { userId, deletedAt: null } } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: {
          ...NOTIFICATION_SELECT,
          pollOptions: POLL_OPTIONS,
          reads: {
            where: { userId, deletedAt: null },
            select: { readAt: true },
          },
        },
        orderBy: { publishedAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.notification.count({ where }),
    ]);
    const polls = await this.pollViews(rows, now, { userId });
    const data = rows.map(({ reads, ...n }) => ({
      ...this.publicFields(n),
      read: reads.length > 0,
      readAt: reads[0]?.readAt ?? null,
      poll: polls.get(n.id) ?? null,
    }));
    return paginate(data, total, query.page, query.limit);
  }

  async unreadCount(userId: string, now = new Date()) {
    const count = await this.prisma.notification.count({
      where: {
        ...visibleAt(now),
        reads: { none: { userId, deletedAt: null } },
      },
    });
    return { count };
  }

  /** Marca como lida. Idempotente: marcar de novo não muda a data da primeira leitura. */
  async markRead(userId: string, notificationId: string, now = new Date()) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, ...visibleAt(now) },
      select: { id: true },
    });
    if (!notification)
      throw new NotFoundException('Notificação não encontrada.');

    const read = await this.prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId } },
      create: { notificationId, userId },
      update: { deletedAt: null },
      select: { readAt: true },
    });
    return { notificationId, read: true, readAt: read.readAt };
  }

  /**
   * Marca como lidas todas as notificações visíveis que o usuário ainda não leu. As já lidas mantêm
   * a data da primeira leitura; `skipDuplicates` cobre dois cliques ao mesmo tempo.
   */
  async markAllRead(userId: string, now = new Date()) {
    const unread = await this.prisma.notification.findMany({
      where: {
        ...visibleAt(now),
        reads: { none: { userId, deletedAt: null } },
      },
      select: { id: true },
    });
    if (unread.length === 0) return { marked: 0 };
    const { count } = await this.prisma.notificationRead.createMany({
      data: unread.map((n) => ({ notificationId: n.id, userId })),
      skipDuplicates: true,
    });
    return { marked: count };
  }

  /**
   * Vota (ou muda o voto) numa enquete aberta. `optionIds` é a escolha completa: o que estava
   * marcado e saiu da lista é desfeito. Votar também marca a notificação como lida.
   */
  async vote(
    userId: string,
    notificationId: string,
    optionIds: string[],
    now = new Date(),
  ): Promise<PollView> {
    await this.prisma.$transaction(async (tx) => {
      // Dois envios ao mesmo tempo da mesma pessoa não podem deixar dois votos numa enquete de
      // resposta única.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'poll-vote:' + notificationId + ':' + userId}))`;
      const poll = await tx.notification.findFirst({
        where: { id: notificationId, ...visibleAt(now) },
        select: {
          type: true,
          pollEndsAt: true,
          pollMultiple: true,
          pollOptions: POLL_OPTIONS,
        },
      });
      if (!poll) throw new NotFoundException('Notificação não encontrada.');
      if (poll.type !== NotificationType.POLL || !poll.pollEndsAt)
        throw new BadRequestException('Esta notificação não é uma enquete.');
      if (now.getTime() >= poll.pollEndsAt.getTime())
        throw new ConflictException('A votação desta enquete já terminou.');
      const valid = new Set(poll.pollOptions.map((o) => o.id));
      if (optionIds.some((id) => !valid.has(id)))
        throw new BadRequestException('Opção inválida para esta enquete.');
      if (!poll.pollMultiple && optionIds.length !== 1)
        throw new BadRequestException('Esta enquete aceita só uma resposta.');

      const current = await tx.notificationPollVote.findMany({
        where: { notificationId, userId },
        select: { optionId: true },
      });
      const chosen = new Set(optionIds);
      const had = new Set(current.map((v) => v.optionId));
      for (const { optionId } of current) {
        if (chosen.has(optionId)) continue;
        await tx.notificationPollVote.update({
          where: { optionId_userId: { optionId, userId } },
          data: { deletedAt: now },
        });
      }
      for (const optionId of optionIds) {
        if (had.has(optionId)) continue;
        await tx.notificationPollVote.upsert({
          where: { optionId_userId: { optionId, userId } },
          create: { optionId, userId, notificationId },
          update: { deletedAt: null, votedAt: now },
        });
      }
      await tx.notificationRead.upsert({
        where: { notificationId_userId: { notificationId, userId } },
        create: { notificationId, userId },
        update: { deletedAt: null },
      });
    });

    const row = await this.prisma.notification.findFirstOrThrow({
      where: { id: notificationId },
      select: { ...NOTIFICATION_SELECT, pollOptions: POLL_OPTIONS },
    });
    const polls = await this.pollViews([row], now, { userId });
    return polls.get(notificationId)!;
  }

  // ---- Enquete: resultado -------------------------------------------------------------------------

  /** Tira do retorno os campos internos da enquete (vão dentro de `poll`). */
  private publicFields<T extends NotificationRow>(
    row: T,
  ): Omit<T, 'pollEndsAt' | 'pollMultiple' | 'pollOptions'> {
    const copy: Partial<T> = { ...row };
    delete copy.pollEndsAt;
    delete copy.pollMultiple;
    delete copy.pollOptions;
    return copy as Omit<T, 'pollEndsAt' | 'pollMultiple' | 'pollOptions'>;
  }

  /** Resultado de cada enquete da lista, do ponto de vista do usuário ou da plataforma. */
  private async pollViews(
    rows: NotificationRow[],
    now: Date,
    viewer: { userId?: string; platform?: boolean },
  ): Promise<Map<string, PollView>> {
    const polls = rows.filter(
      (r) => r.type === NotificationType.POLL && r.pollEndsAt,
    );
    const result = new Map<string, PollView>();
    if (polls.length === 0) return result;

    const ids = polls.map((p) => p.id);
    const where = { notificationId: { in: ids }, deletedAt: null };
    const [byOption, voters, mine] = await Promise.all([
      this.prisma.notificationPollVote.groupBy({
        by: ['optionId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.notificationPollVote.groupBy({
        by: ['notificationId', 'userId'],
        where,
      }),
      viewer.userId
        ? this.prisma.notificationPollVote.findMany({
            where: { ...where, userId: viewer.userId },
            select: { notificationId: true, optionId: true },
          })
        : Promise.resolve([] as { notificationId: string; optionId: string }[]),
    ]);

    const counts = new Map(byOption.map((g) => [g.optionId, g._count._all]));
    const votersBy = new Map<string, number>();
    for (const v of voters)
      votersBy.set(v.notificationId, (votersBy.get(v.notificationId) ?? 0) + 1);

    for (const p of polls) {
      result.set(
        p.id,
        buildPollView({
          endsAt: p.pollEndsAt!,
          multiple: p.pollMultiple,
          options: p.pollOptions,
          counts,
          voters: votersBy.get(p.id) ?? 0,
          myOptionIds: mine
            .filter((m) => m.notificationId === p.id)
            .map((m) => m.optionId),
          now,
          alwaysShowResults: viewer.platform,
        }),
      );
    }
    return result;
  }
}
