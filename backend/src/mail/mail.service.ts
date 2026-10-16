import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { Env } from '../config/env';

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
    return this.send({
      to,
      subject: 'Redefinição de senha',
      text: `Olá, ${name}.\n\nPara definir uma nova senha, acesse o link (válido por 30 minutos):\n${url}\n\nSe não foi você, ignore esta mensagem.`,
      html: `<p>Olá, ${escapeHtml(name)}.</p><p>Para definir uma nova senha, <a href="${url}">clique aqui</a> (o link vale por 30 minutos).</p><p>Se não foi você, ignore esta mensagem.</p>`,
    });
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
      subject: `Convite para ${companyName}`,
      text: `Olá, ${name}.\n\n${invitedBy} convidou você para ${companyName}. Para criar sua senha e acessar, use o link (válido por 7 dias):\n${url}`,
      html: `<p>Olá, ${escapeHtml(name)}.</p><p>${escapeHtml(invitedBy)} convidou você para <b>${escapeHtml(companyName)}</b>.</p><p><a href="${url}">Criar minha senha e acessar</a> (o link vale por 7 dias).</p>`,
    });
  }

  sendSubscriptionReminder(
    to: string,
    name: string,
    subject: string,
    body: string,
  ) {
    return this.send({
      to,
      subject,
      text: `Olá, ${name}.\n\n${body}`,
      html: `<p>Olá, ${escapeHtml(name)}.</p><p>${escapeHtml(body)}</p>`,
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}
