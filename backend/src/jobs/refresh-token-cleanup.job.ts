import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditContext } from '../audit/audit-context';
import { addDays } from '../common/utils/time';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Limpeza diária: refresh tokens expirados há mais de 1 dia saem de circulação (soft delete).
 * Os revogados que ainda não expiraram continuam, para a detecção de reuso seguir funcionando.
 */
@Injectable()
export class RefreshTokenCleanupJob {
  private readonly logger = new Logger(RefreshTokenCleanupJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  @Cron('0 3 * * *', {
    name: 'refresh-token-cleanup',
    timeZone: 'America/Sao_Paulo',
  })
  async handle() {
    try {
      const { removed } = await this.audit.runAsSystem(
        'job:refresh-token-cleanup',
        () => this.run(new Date()),
      );
      this.logger.log(`Refresh tokens expirados removidos: ${removed}`);
    } catch (error) {
      this.logger.error(
        `Falha na limpeza de refresh tokens: ${(error as Error).message}`,
      );
    }
  }

  async run(now: Date): Promise<{ removed: number }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { expiresAt: { lt: addDays(now, -1) } },
      data: { deletedAt: now },
    });
    return { removed: result.count };
  }
}
