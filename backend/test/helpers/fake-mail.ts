import { MailMessage } from '../../src/mail/mail.service';
import {
  inviteEmail,
  passwordResetEmail,
  subscriptionReminderEmail,
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

  /** Último link (http...) enviado para o destinatário. */
  lastLinkTo(to: string): string | undefined {
    const message = [...this.sent].reverse().find((m) => m.to === to);
    return message?.text.match(/https?:\/\/\S+/)?.[0];
  }

  reset() {
    this.sent = [];
  }
}
