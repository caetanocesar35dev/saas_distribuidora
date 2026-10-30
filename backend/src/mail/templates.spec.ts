import {
  escapeHtml,
  inviteEmail,
  passwordResetEmail,
  subscriptionReminderEmail,
} from './templates';

describe('templates de e-mail', () => {
  const url = 'http://localhost:3000/redefinir-senha?token=a.b&x=1';

  it('redefinição de senha: assunto, botão com o link e validade de 30 minutos', () => {
    const email = passwordResetEmail('Maria', url);
    expect(email.subject).toBe('Redefinição de senha - Distribuidora');
    expect(email.text).toContain('Olá, Maria.');
    expect(email.text).toContain(`Criar nova senha: ${url}`);
    expect(email.text).toContain('30 minutos');
    // no HTML, o & do link vira &amp; (atributo válido) e aparece no botão e no endereço de reserva
    expect(email.html).toContain(
      'href="http://localhost:3000/redefinir-senha?token=a.b&amp;x=1"',
    );
    expect(email.html.match(/href="/g)).toHaveLength(2);
    expect(email.html).toContain('Criar nova senha');
  });

  it('convite: empresa e quem convidou no assunto e no texto, validade de 7 dias', () => {
    const email = inviteEmail('João', 'Bebidas Centro', 'Ana Dona', url);
    expect(email.subject).toBe('Convite para Bebidas Centro - Distribuidora');
    expect(email.text).toContain(
      'Ana Dona convidou você para usar o sistema de Bebidas Centro',
    );
    expect(email.text).toContain('7 dias');
    expect(email.html).toContain('Criar minha senha e acessar');
  });

  it('lembrete de assinatura: usa o assunto e o texto do job, com o botão para o sistema', () => {
    const email = subscriptionReminderEmail(
      'Carlos',
      'Seu período de teste termina amanhã',
      'Assine um plano.',
      'http://localhost:3000/login',
    );
    expect(email.subject).toBe('Seu período de teste termina amanhã');
    expect(email.text).toContain('Assine um plano.');
    expect(email.text).toContain(
      'Acessar o sistema: http://localhost:3000/login',
    );
  });

  it('escapa o texto variável no HTML (nome, empresa) e não no texto puro', () => {
    const email = inviteEmail('<b>Zé</b>', 'Bar & Cia "Top"', 'Ana', url);
    expect(email.html).not.toContain('<b>Zé</b>');
    expect(email.html).toContain('&lt;b&gt;Zé&lt;/b&gt;');
    expect(email.html).toContain('Bar &amp; Cia &quot;Top&quot;');
    expect(email.text).toContain('Olá, <b>Zé</b>.');
    expect(escapeHtml(`<a href='x'>&`)).toBe('&lt;a href=&#39;x&#39;&gt;&amp;');
  });
});
