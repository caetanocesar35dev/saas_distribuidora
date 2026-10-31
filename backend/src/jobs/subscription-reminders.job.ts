import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AuditContext } from '../audit/audit-context';
import { addDays, formatDayInTz } from '../common/utils/time';
import { Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export type ReminderKind =
  | 'TRIAL_3_DAYS'
  | 'TRIAL_1_DAY'
  | 'TRIAL_ENDED'
  | 'GRACE_ENDS_TOMORROW'
  | 'GRACE_ENDED';

export interface Reminder {
  organizationId: string;
  kind: ReminderKind;
  to: string;
  name: string;
}

const MESSAGES: Record<ReminderKind, { subject: string; body: string }> = {
  TRIAL_3_DAYS: {
    subject: 'Seu período de teste termina em 3 dias',
    body: 'Faltam 3 dias para o fim do seu período de teste. Assine um plano para continuar usando o sistema sem interrupção.',
  },
  TRIAL_1_DAY: {
    subject: 'Seu período de teste termina amanhã',
    body: 'Seu período de teste termina amanhã. Depois disso o sistema passa para o modo somente leitura até a assinatura ser feita.',
  },
  TRIAL_ENDED: {
    subject:
      'Seu período de teste terminou: o sistema está somente para consulta',
    body: 'O seu período de teste terminou e o sistema passou para o modo somente leitura: você ainda consulta tudo e fecha o caixa que estava aberto, mas não vende nem cadastra. Seus dados continuam guardados. Escolha um plano em Painel da empresa › Assinatura para voltar a usar tudo.',
  },
  GRACE_ENDS_TOMORROW: {
    subject:
      'Sua mensalidade está em atraso: o acesso ficará somente leitura amanhã',
    body: 'A mensalidade está em atraso e o prazo de carência termina amanhã. Depois disso o sistema passa para o modo somente leitura (você ainda poderá consultar tudo, fechar o caixa e pagar a assinatura).',
  },
  GRACE_ENDED: {
    subject: 'Mensalidade em atraso: o sistema está somente para consulta',
    body: 'O prazo de carência da mensalidade em atraso terminou e o sistema passou para o modo somente leitura: você ainda consulta tudo, fecha o caixa que estava aberto e pode pagar a assinatura. Seus dados continuam guardados. Assim que o pagamento for confirmado, o acesso completo volta sozinho.',
  },
};

/**
 * Avisa o responsável pela cobrança, por e-mail, que o teste ou a carência está acabando e, no dia
 * seguinte ao fim, que o sistema ficou somente leitura. NÃO muda status: o modo somente leitura é
 * calculado na hora a partir de trialEndsAt e pastDueSince.
 */
@Injectable()
export class SubscriptionRemindersJob {
  private readonly logger = new Logger(SubscriptionRemindersJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron('0 9 * * *', {
    name: 'subscription-reminders',
    timeZone: 'America/Sao_Paulo',
  })
  async handle() {
    try {
      const { sent } = await this.audit.runAsSystem(
        'job:subscription-reminders',
        () => this.run(new Date()),
      );
      this.logger.log(`Lembretes de assinatura enviados: ${sent}`);
    } catch (error) {
      this.logger.error(
        `Falha no job de lembretes: ${(error as Error).message}`,
      );
    }
  }

  /** Quem deve receber lembrete hoje (separado do envio para ser testável). */
  async findReminders(now: Date): Promise<Reminder[]> {
    const tz = this.config.get('APP_TIMEZONE', { infer: true });
    const graceDays = this.config.get('SUBSCRIPTION_GRACE_DAYS', {
      infer: true,
    });
    const day = (date: Date) => formatDayInTz(date, tz);
    const in3Days = day(addDays(now, 3));
    const tomorrow = day(addDays(now, 1));
    // O aviso de "acabou" sai uma vez, no dia seguinte ao fim (o job roda de manhã).
    const yesterday = day(addDays(now, -1));

    const orgs = await this.prisma.organization.findMany({
      where: {
        OR: [
          {
            subscriptionStatus: 'TRIAL',
            trialEndsAt: { gt: addDays(now, -3), lt: addDays(now, 5) },
          },
          { subscriptionStatus: 'PAST_DUE', pastDueSince: { not: null } },
        ],
      },
      select: {
        id: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        pastDueSince: true,
        owner: { select: { name: true, email: true, isActive: true } },
      },
    });

    const reminders: Reminder[] = [];
    for (const org of orgs) {
      if (!org.owner.isActive) continue;
      let kind: ReminderKind | null = null;

      if (org.subscriptionStatus === 'TRIAL' && org.trialEndsAt) {
        const endsOn = day(org.trialEndsAt);
        if (endsOn === in3Days) kind = 'TRIAL_3_DAYS';
        else if (endsOn === tomorrow) kind = 'TRIAL_1_DAY';
        else if (endsOn === yesterday) kind = 'TRIAL_ENDED';
      } else if (org.subscriptionStatus === 'PAST_DUE' && org.pastDueSince) {
        const graceEndsOn = day(addDays(org.pastDueSince, graceDays));
        if (graceEndsOn === tomorrow) kind = 'GRACE_ENDS_TOMORROW';
        else if (graceEndsOn === yesterday) kind = 'GRACE_ENDED';
      }

      if (kind)
        reminders.push({
          organizationId: org.id,
          kind,
          to: org.owner.email,
          name: org.owner.name,
        });
    }
    return reminders;
  }

  async run(now: Date): Promise<{ sent: number }> {
    const reminders = await this.findReminders(now);
    let sent = 0;
    for (const r of reminders) {
      const { subject, body } = MESSAGES[r.kind];
      if (await this.mail.sendSubscriptionReminder(r.to, r.name, subject, body))
        sent++;
    }
    return { sent };
  }
}
