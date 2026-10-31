import { formatDateBr, MailMessage } from '../../src/mail/mail.service';
import {
  inviteEmail,
  passwordChangedEmail,
  passwordResetEmail,
  referralRewardEmail,
  subscriptionReminderEmail,
  welcomeEmail,
} from '../../src/mail/templates';

/**
 * Substitui o MailService nos testes: guarda as mensagens em vez de enviá-las. Usa os mesmos
 * templates do envio real, então os testes também passam pelos textos de verdade.
 */
export class FakeMailService {
  sent: MailMessage[] = [];

  async send(message: MailMessage) {
    this.sent.push(message);
    return true;
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
    return this.send({
      to,
      ...subscriptionReminderEmail(
        name,
        subject,
        body,
        'http://localhost:3000/login',
      ),
    });
  }

  sendWelcome(
    to: string,
    name: string,
    companyName: string,
    trialEndsAt: Date | null,
  ) {
    return this.send({
      to,
      ...welcomeEmail(
        name,
        companyName,
        trialEndsAt ? formatDateBr(trialEndsAt, 'America/Sao_Paulo') : null,
        'http://localhost:3000/login',
      ),
    });
  }

  sendPasswordChanged(to: string, name: string) {
    return this.send({
      to,
      ...passwordChangedEmail(name, 'http://localhost:3000/esqueci-a-senha'),
    });
  }

  sendReferralReward(
    to: string,
    name: string,
    referredName: string,
    months: number,
    percent: number,
  ) {
    return this.send({
      to,
      ...referralRewardEmail(
        name,
        referredName,
        months,
        percent,
        'http://localhost:3000/indique',
      ),
    });
  }

  /** Mensagens enviadas para o destinatário, na ordem. */
  sentTo(to: string): MailMessage[] {
    return this.sent.filter((m) => m.to === to);
  }

  /** Último link (http...) enviado para o destinatário. */
  lastLinkTo(to: string): string | undefined {
    const message = [...this.sent].reverse().find((m) => m.to === to);
    return message?.text.match(/https?:\/\/\S+/)?.[0];
  }

  reset() {
    this.sent = [];
  }
}
