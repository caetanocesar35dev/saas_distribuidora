import { createTestApp, TestApp } from './helpers/app';

describe('Infraestrutura HTTP: segurança, Swagger, CORS e rate limit (e2e)', () => {
  describe('cabeçalhos, CORS e erros', () => {
    let t: TestApp;
    beforeAll(async () => {
      t = await createTestApp();
    });
    afterAll(() => t.close());

    it('helmet: cabeçalhos de segurança e sem x-powered-by', async () => {
      const res = await t.http.get('/api/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('CORS: só a origem configurada (CORS_ORIGINS) é aceita', async () => {
      const allowed = await t.http
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');
      expect(allowed.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');

      const evil = await t.http
        .get('/api/health')
        .set('Origin', 'https://site-malicioso.com');
      expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rota inexistente e JSON quebrado respondem em JSON, sem vazar detalhes internos', async () => {
      const notFound = await t.http.get('/api/nao-existe').expect(404);
      expect(notFound.body).toHaveProperty('statusCode', 404);

      const broken = await t.http
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": ')
        .expect(400);
      expect(JSON.stringify(broken.body)).not.toMatch(/node_modules|at .*\.ts/);
    });

    it('o prefixo /api é obrigatório', async () => {
      await t.http.get('/health').expect(404);
    });
  });

  describe('Swagger', () => {
    it('ligado: documenta as rotas em /api/docs-json', async () => {
      const t = await createTestApp({ swagger: true });
      try {
        const res = await t.http.get('/api/docs-json').expect(200);
        expect(Object.keys(res.body.paths)).toEqual(
          expect.arrayContaining([
            '/api/auth/login',
            '/api/stores/{storeId}/sales',
            '/api/companies/{companyId}/products',
          ]),
        );
        expect(res.body.components.securitySchemes).toHaveProperty('bearer');
      } finally {
        await t.close();
      }
    });

    it('desligado (padrão em produção): /api/docs-json não existe', async () => {
      const t = await createTestApp({ swagger: false });
      try {
        await t.http.get('/api/docs-json').expect(404);
      } finally {
        await t.close();
      }
    });
  });

  describe('rate limiting', () => {
    let t: TestApp;
    beforeAll(async () => {
      process.env.RATE_LIMIT_IN_TEST = '1'; // nos outros testes o limite fica desligado
      t = await createTestApp();
    });
    afterAll(async () => {
      delete process.env.RATE_LIMIT_IN_TEST;
      await t.close();
    });
    beforeEach(() => t.reset());

    it('login: a 6ª tentativa do mesmo e-mail no minuto leva 429; outro e-mail não é afetado', async () => {
      const user = await t.factory.user();
      const other = await t.factory.user();
      const attempt = (email: string, password: string) =>
        t.http.post('/api/auth/login').send({ email, password });

      for (let i = 0; i < 5; i++)
        await attempt(user.email, 'errada!!').expect(401);
      await attempt(user.email, 'errada!!').expect(429);
      // mesmo com a senha certa, enquanto estiver no limite
      await attempt(user.email, 'Senha@123').expect(429);
      // outro usuário (outra chave IP + e-mail) continua entrando
      await attempt(other.email, 'Senha@123').expect(200);
    });

    it('cadastro e "esqueci a senha" têm limites próprios por hora', async () => {
      const body = { email: 'alguem@teste.com' };
      for (let i = 0; i < 3; i++)
        await t.http.post('/api/auth/forgot-password').send(body).expect(200);
      await t.http.post('/api/auth/forgot-password').send(body).expect(429);
    });

    it('rotas comuns têm um limite alto por usuário (não atrapalha o uso normal)', async () => {
      const user = await t.factory.user();
      const auth = await t.login(user.email);
      for (let i = 0; i < 20; i++)
        await t.http.get('/api/me').set(auth).expect(200);
    });
  });
});
