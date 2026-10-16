import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  paginate,
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNotificationDto,
  ListMyNotificationsQuery,
  UpdateNotificationDto,
} from './notifications.dto';

const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  body: true,
  type: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

/** Publicada (data de publicação já chegou) e ainda não expirada. */
const visibleAt = (now: Date): Prisma.NotificationWhereInput => ({
  publishedAt: { lte: now },
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Plataforma (SUPERADMIN) --------------------------------------------------------------------

  async listAll(query: PaginationQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        select: {
          ...NOTIFICATION_SELECT,
          createdBy: { select: { id: true, name: true } },
          _count: { select: { reads: true } },
        },
        orderBy: { publishedAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.notification.count(),
    ]);
    return paginate(
      data.map(({ _count, ...n }) => ({ ...n, readCount: _count.reads })),
      total,
      query.page,
      query.limit,
    );
  }

  async create(userId: string, dto: CreateNotificationDto) {
    this.assertDates(dto.publishedAt ?? new Date(), dto.expiresAt);
    return this.prisma.notification.create({
      data: {
        title: dto.title,
        body: dto.body,
        type: dto.type,
        publishedAt: dto.publishedAt,
        expiresAt: dto.expiresAt ?? null,
        createdByUserId: userId,
      },
      select: NOTIFICATION_SELECT,
    });
  }

  async update(id: string, dto: UpdateNotificationDto) {
    const current = await this.prisma.notification.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Notificação não encontrada.');
    this.assertDates(
      dto.publishedAt ?? current.publishedAt,
      dto.expiresAt === undefined ? current.expiresAt : dto.expiresAt,
    );
    return this.prisma.notification.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        type: dto.type,
        publishedAt: dto.publishedAt,
        expiresAt: dto.expiresAt,
      },
      select: NOTIFICATION_SELECT,
    });
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

  private assertDates(publishedAt: Date, expiresAt?: Date | null) {
    if (expiresAt && expiresAt.getTime() <= publishedAt.getTime()) {
      throw new BadRequestException(
        'A data de expiração precisa ser depois da data de publicação.',
      );
    }
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
    const data = rows.map(({ reads, ...n }) => ({
      ...n,
      read: reads.length > 0,
      readAt: reads[0]?.readAt ?? null,
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
}
