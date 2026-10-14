import { buildCnpj } from '../src/common/utils/document';
import { createTestApp, TestApp } from './helpers/app';

describe('Autenticação e conta (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await t.reset();
    await t.factory.plan({ name: 'Trial', priceInCents: 0 });
  });
  afterAll(() => t.close());

  const signupBody = (over: Record<string, unknown> = {}) => ({
    name: 'Maria Dona',
    email: 'maria@dist.com',
    password: 'Senha@123',
    cnpj: buildCnpj('111222330001'),
    razaoSocial: 'Maria Distribuidora LTDA',
    nomeFantasia: 'Maria Bebidas',
    storeName: 'Matriz',
    ...over,
  });

  it('GET /api/health é público', async () => {
    await t.http.get('/api/health').expect(200).expect({ status: 'ok' });
  });

  it('GET /api/plans é público e não expõe campos internos', async () => {
    const res = await t.http.get('/api/plans').expect(200);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ name: 'Trial', priceInCents: 0 }),
    );
    expect(res.body[0]).not.toHaveProperty('modifierId');
  });

  it('rotas protegidas exigem token', async () => {
    await t.http.get('/api/me').expect(401);
    await t.http.get('/api/me/memberships').expect(401);
    await t.http.get('/api/me').set('Authorization', 'Bearer lixo').expect(401);
  });

  it('fluxo completo: cadastro -> /me -> memberships -> refresh -> logout', async () => {
    const signup = await t.http
      .post('/api/auth/signup')
      .send(signupBody())
      .expect(201);
    const auth = { Authorization: `Bearer ${signup.body.access_token}` };

    const me = await t.http.get('/api/me').set(auth).expect(200);
    expect(me.body).toMatchObject({
      email: 'maria@dist.com',
      name: 'Maria Dona',
    });
    expect(me.body).not.toHaveProperty('passwordHash');

    const memberships = await t.http
      .get('/api/me/memberships')
      .set(auth)
      .expect(200);
    expect(memberships.body).toHaveLength(1);
    expect(memberships.body[0]).toMatchObject({
      companyName: 'Maria Bebidas',
      isCompanyOwner: true,
      isBillingOwner: true,
      stores: [{ storeName: 'Matriz', role: 'OWNER' }],
      subscription: { status: 'TRIAL', accessMode: 'FULL' },
    });

    const refreshed = await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: signup.body.refresh_token })
      .expect(200);
    expect(refreshed.body.refresh_token).not.toBe(signup.body.refresh_token);
    await t.http
      .get('/api/me')
      .set({ Authorization: `Bearer ${refreshed.body.access_token}` })
      .expect(200);

    // reuso do refresh token antigo derruba a família
    await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: signup.body.refresh_token })
      .expect(401);
    await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshed.body.refresh_token })
      .expect(401);

    await t.http
      .post('/api/auth/logout')
      .send({ refreshToken: 'qualquer' })
      .expect(200);
  });

  it('o interceptor de auditoria grava a rota e o usuário nas alterações', async () => {
    const user = await t.factory.user({ name: 'Antigo' });
    const auth = await t.login(user.email);
    await t.http
      .patch('/api/me')
      .set(auth)
      .send({ name: 'Novo Nome' })
      .expect(200);

    const history = await t.prisma.userHistory.findMany({
      where: { id: user.id },
      orderBy: { historyStart: 'asc' },
    });
    const last = history[history.length - 1];
    expect(last).toMatchObject({
      name: 'Novo Nome',
      modifierId: user.id,
      modifiedEndpoint: 'PATCH /api/me',
    });
  });

  describe('validação e erros', () => {
    it('rejeita campos desconhecidos (forbidNonWhitelisted) e dados inválidos com 400', async () => {
      const res = await t.http
        .post('/api/auth/login')
        .send({ email: 'x@y.com', password: 'a', modifierId: 'hack' })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('modifierId');
      await t.http
        .post('/api/auth/login')
        .send({ email: 'nao-e-email', password: 'a' })
        .expect(400);
      await t.http
        .post('/api/auth/signup')
        .send(signupBody({ password: 'curta' }))
        .expect(400);
    });

    it('cadastro com e-mail repetido responde 409 e CNPJ inválido 400', async () => {
      await t.http.post('/api/auth/signup').send(signupBody()).expect(201);
      await t.http
        .post('/api/auth/signup')
        .send(signupBody({ cnpj: buildCnpj('999888770001') }))
        .expect(409);
      await t.http
        .post('/api/auth/signup')
        .send(signupBody({ email: 'o@o.com', cnpj: '11222333000199' }))
        .expect(400);
    });

    it('login errado responde 401 sem revelar se o e-mail existe', async () => {
      const user = await t.factory.user();
      const wrong = await t.http
        .post('/api/auth/login')
        .send({ email: user.email, password: 'errada!!' })
        .expect(401);
      const unknown = await t.http
        .post('/api/auth/login')
        .send({ email: 'fantasma@x.com', password: 'errada!!' })
        .expect(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });
  });

  describe('usuário desativado', () => {
    it('perde o acesso na hora, mesmo com o access token ainda válido', async () => {
      const user = await t.factory.user();
      const auth = await t.login(user.email);
      await t.http.get('/api/me').set(auth).expect(200);

      await t.audit.runAsSystem('seed', () =>
        t.prisma.user.update({
          where: { id: user.id },
          data: { isActive: false },
        }),
      );
      await t.http.get('/api/me').set(auth).expect(401);
    });
  });

  it('esqueci a senha -> link -> nova senha -> login', async () => {
    const user = await t.factory.user({ email: 'ana@teste.com' });
    await t.http
      .post('/api/auth/forgot-password')
      .send({ email: 'ana@teste.com' })
      .expect(200);
    const token = decodeURIComponent(
      t.mail.lastLinkTo(user.email)!.split('token=')[1],
    );

    await t.http
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NovaSenha@1' })
      .expect(200);
    await t.http
      .post('/api/auth/login')
      .send({ email: user.email, password: 'NovaSenha@1' })
      .expect(200);
    await t.http
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'OutraSenha@1' })
      .expect(400);
  });
});
