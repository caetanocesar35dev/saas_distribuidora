import { MailMessage } from '../../src/mail/mail.service';

/** Substitui o MailService nos testes: guarda as mensagens em vez de enviá-las. */
export class FakeMailService {
  sent: MailMessage[] = [];

  async send(message: MailMessage) {
    this.sent.push(message);
    return true;
  }

  sendPasswordReset(to: string, name: string, url: string) {
    return this.send({
      to,
      subject: 'Redefinição de senha',
      text: `${name} ${url}`,
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
      text: `${name} ${invitedBy} ${url}`,
    });
  }

  sendSubscriptionReminder(
    to: string,
    name: string,
    subject: string,
    body: string,
  ) {
    return this.send({ to, subject, text: `${name} ${body}` });
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
