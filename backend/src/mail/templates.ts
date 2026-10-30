/**
 * Templates dos e-mails do sistema. Cada função devolve assunto, texto puro e HTML.
 *
 * O HTML segue as regras de e-mail (não de site): layout em tabelas, estilos inline, largura
 * máxima de 560 px e botão "à prova de bala" (tabela com fundo), para sair igual no Gmail, no
 * Outlook e no celular. O texto puro vai junto para quem não abre HTML e ajuda a não cair no spam.
 * Todo texto variável passa por `escapeHtml`.
 */

export const APP_NAME = 'Distribuidora';

/** Cor principal do sistema (a mesma `--primary` do frontend, âmbar). */
const PRIMARY = '#b45309';
const TEXT = '#18181b';
const MUTED = '#71717a';
const BORDER = '#e4e4e7';
const BACKGROUND = '#f4f4f5';
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

interface Layout {
  subject: string;
  /** Resumo que aparece ao lado do assunto na caixa de entrada. */
  preheader: string;
  title: string;
  name: string;
  /** Parágrafos em texto puro (escapados aqui). */
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Observação em letra menor, abaixo do botão. */
  note?: string;
  /** Por que a pessoa recebeu o e-mail (rodapé). */
  reason: string;
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

function render(layout: Layout): EmailContent {
  const { button } = layout;
  const greeting = `Olá, ${layout.name}.`;

  const text = [
    greeting,
    '',
    ...layout.paragraphs.flatMap((p) => [p, '']),
    ...(button ? [`${button.label}: ${button.url}`, ''] : []),
    ...(layout.note ? [layout.note, ''] : []),
    '--',
    `${APP_NAME}. ${layout.reason}`,
    'Esta é uma mensagem automática; não é preciso responder.',
  ].join('\n');

  const paragraph = (content: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${TEXT};">${content}</p>`;

  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td align="center" bgcolor="${PRIMARY}" style="border-radius:8px;">
      <a href="${escapeHtml(button.url)}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(button.label)}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:${MUTED};">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${escapeHtml(button.url)}" target="_blank" style="color:${PRIMARY};word-break:break-all;">${escapeHtml(button.url)}</a></p>`
    : '';

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(layout.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BACKGROUND};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(layout.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BACKGROUND}">
  <tr>
    <td align="center" style="padding:32px 16px;font-family:${FONT};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:0 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="32" height="32" align="center" bgcolor="${PRIMARY}" style="border-radius:8px;font-size:18px;line-height:32px;">&#127866;</td>
                <td style="padding-left:10px;font-size:18px;font-weight:600;color:${TEXT};">${APP_NAME}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="padding:32px;border:1px solid ${BORDER};border-radius:12px;">
            <h1 style="margin:0 0 20px;font-size:20px;line-height:28px;font-weight:600;color:${TEXT};">${escapeHtml(layout.title)}</h1>
            ${paragraph(escapeHtml(greeting))}
            ${layout.paragraphs.map((p) => paragraph(escapeHtml(p))).join('\n            ')}
            ${buttonHtml}
            ${layout.note ? `<p style="margin:0;font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(layout.note)}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;font-size:12px;line-height:18px;color:${MUTED};text-align:center;">
            ${escapeHtml(layout.reason)}<br>Esta é uma mensagem automática; não é preciso responder.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: layout.subject, text, html };
}

export function passwordResetEmail(name: string, url: string): EmailContent {
  return render({
    subject: `Redefinição de senha - ${APP_NAME}`,
    preheader: 'Use o link para criar uma nova senha. Ele vale por 30 minutos.',
    title: 'Redefinir sua senha',
    name,
    paragraphs: [
      'Recebemos um pedido para redefinir a senha da sua conta. Para criar uma nova senha, use o botão abaixo.',
    ],
    button: { label: 'Criar nova senha', url },
    note: 'O link vale por 30 minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.',
    reason:
      'Você recebeu este e-mail porque alguém pediu para redefinir a senha desta conta.',
  });
}

export function inviteEmail(
  name: string,
  companyName: string,
  invitedBy: string,
  url: string,
): EmailContent {
  return render({
    subject: `Convite para ${companyName} - ${APP_NAME}`,
    preheader: `${invitedBy} convidou você para usar o sistema de ${companyName}.`,
    title: `Você foi convidado para ${companyName}`,
    name,
    paragraphs: [
      `${invitedBy} convidou você para usar o sistema de ${companyName}: vendas, caixa, estoque e fiado.`,
      'Para entrar, crie a sua senha pelo botão abaixo.',
    ],
    button: { label: 'Criar minha senha e acessar', url },
    note: 'O convite vale por 7 dias. Se você não esperava este convite, pode ignorar este e-mail.',
    reason: `Você recebeu este e-mail porque foi convidado para a equipe de ${companyName}.`,
  });
}

export function subscriptionReminderEmail(
  name: string,
  subject: string,
  body: string,
  url: string,
): EmailContent {
  return render({
    subject,
    preheader: body,
    title: subject,
    name,
    paragraphs: [body],
    button: { label: 'Acessar o sistema', url },
    reason:
      'Você recebeu este e-mail porque é o responsável pela assinatura desta conta.',
  });
}
