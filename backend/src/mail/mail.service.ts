import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { Env } from '../config/env';
import {
  inviteEmail,
  passwordResetEmail,
  subscriptionReminderEmail,
} from './templates';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Envio de e-mail via nodemailer, configurado por EMAIL_HOST/PORT/USER/PASS.
 * Sem EMAIL_USER/EMAIL_PASS nada é enviado: a mensagem (com o link) vai só para o log.
 * Falha de envio nunca derruba a operação principal: é registrada e o método devolve false.
 * O conteúdo (assunto, texto e HTML) vem de `templates.ts`. Para ver todos chegando de verdade:
 * `npm run mail:test -- destino@exemplo.com`.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const user = config.get('EMAIL_USER', { infer: true });
    const pass = config.get('EMAIL_PASS', { infer: true });
    const port = config.get('EMAIL_PORT', { infer: true });
    this.from =
      config.get('EMAIL_FROM', { infer: true }) ??
      user ??
      'nao-responder@localhost';
    if (user && pass) {
      this.transporter = createTransport({
        host: config.get('EMAIL_HOST', { infer: true }),
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  async send(message: MailMessage): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(
        `E-mail NÃO enviado (SMTP não configurado) para ${message.to}: ${message.subject}\n${message.text}`,
      );
      return false;
    }
    try {
      await this.transporter.sendMail({ from: this.from, ...message });
      return true;
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail para ${message.to}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  sendPasswordReset(to: string, name: string, url: string) {
    return this.send({ to, ...passwordResetEmail(name, url) });
  }

  sendInvite(
    to: string,
    name: string,
    companyName: string,
    invitedBy: string,
    url: string,
  ) {
    return this.send({
      to,
      ...inviteEmail(name, companyName, invitedBy, url),
    });
  }

  sendSubscriptionReminder(
    to: string,
    name: string,
    subject: string,
    body: string,
  ) {
    const url = `${this.config.get('APP_URL', { infer: true })}/login`;
    return this.send({
      to,
      ...subscriptionReminderEmail(name, subject, body, url),
    });
  }
}
