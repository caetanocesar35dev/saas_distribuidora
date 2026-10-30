/**
 * Envia de verdade os três e-mails do sistema (redefinição de senha, convite e lembrete de
 * assinatura), com dados de exemplo, para conferir a configuração do SMTP e a aparência.
 *
 *   npm run mail:test -- destino@exemplo.com
 *
 * Sem destino, envia para o próprio EMAIL_USER. Usa as variáveis EMAIL_* do backend/.env. Os
 * links são de exemplo (não redefinem senha nem aceitam convite de ninguém).
 */
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { validateEnv } from '../src/config/env';
import { MailService } from '../src/mail/mail.service';

async function main() {
  const env = validateEnv(process.env);
  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    console.error(
      'Preencha EMAIL_USER e EMAIL_PASS no backend/.env antes de testar o envio.',
    );
    process.exit(1);
  }
  const to = process.argv[2] ?? env.EMAIL_USER;
  const mail = new MailService(new ConfigService(env));
  const sample = `${env.APP_URL}/redefinir-senha?token=exemplo-sem-validade`;

  const results = [
    [
      'Redefinição de senha',
      await mail.sendPasswordReset(to, 'Maria Exemplo', sample),
    ],
    [
      'Convite',
      await mail.sendInvite(
        to,
        'Maria Exemplo',
        'Distribuidora Exemplo',
        'João Dono',
        sample,
      ),
    ],
    [
      'Lembrete de assinatura',
      await mail.sendSubscriptionReminder(
        to,
        'Maria Exemplo',
        'Seu período de teste termina em 3 dias',
        'Faltam 3 dias para o fim do seu período de teste. Assine um plano para continuar usando o sistema sem interrupção.',
      ),
    ],
  ] as const;

  for (const [name, ok] of results)
    console.log(`${ok ? 'Enviado' : 'FALHOU '}  ${name} -> ${to}`);
  if (results.some(([, ok]) => !ok)) {
    console.error(
      'Algum envio falhou: veja a mensagem de erro acima (senha de app, usuário ou porta).',
    );
    process.exit(1);
  }
}

void main();
