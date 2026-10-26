import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AuditContext } from '../audit/audit-context';
import { autoCloseDue } from '../cash-register/cash-auto';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Fecha sozinho o caixa esquecido aberto (decisão do usuário, 2026-10-26): quando o relógio da loja
 * passa do horário de fechamento (`Store.cashAutoCloseTime`, padrão meia-noite) depois da abertura,
 * o caixa fecha com o saldo calculado e fica marcado `autoClosed`. Roda a cada 5 minutos.
 */
@Injectable()
export class CashAutoCloseJob {
  private readonly logger = new Logger(CashAutoCloseJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
    private readonly cash: CashRegisterService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron('*/5 * * * *', { name: 'cash-auto-close' })
  async handle() {
    try {
      const { closed } = await this.audit.runAsSystem(
        'job:cash-auto-close',
        () => this.run(new Date()),
      );
      if (closed > 0)
        this.logger.log(`${closed} caixa(s) fechado(s) automaticamente.`);
    } catch (error) {
      this.logger.error(
        `Falha ao fechar caixas automaticamente: ${(error as Error).message}`,
      );
    }
  }

  /** Fecha os caixas abertos cujo horário de fechamento já passou. */
  async run(now: Date): Promise<{ closed: number }> {
    const timeZone = this.config.get('APP_TIMEZONE', { infer: true });
    const open = await this.prisma.cashRegister.findMany({
      where: { status: 'OPEN', store: { deletedAt: null } },
      select: {
        id: true,
        storeId: true,
        openedAt: true,
        store: { select: { cashAutoCloseTime: true } },
      },
    });
    let closed = 0;
    for (const register of open) {
      const due = autoCloseDue(
        register.openedAt,
        register.store.cashAutoCloseTime,
        timeZone,
      );
      if (now.getTime() < due.getTime()) continue;
      if (await this.cash.closeAutomatically(register.storeId, register.id))
        closed += 1;
    }
    return { closed };
  }
}
