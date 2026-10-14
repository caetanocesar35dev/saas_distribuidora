import { createTestApp, TestApp } from './helpers/app';
import { World } from './helpers/factory';

describe('Isolamento de tenant, papéis e assinatura (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => t.reset());
  afterAll(() => t.close());

  const day = (n: number) => new Date(Date.now() + n * 86_400_000);

  async function scenario() {
    const a = await t.factory.world();
    const b = await t.factory.world();
    const manager = await t.factory.member(a.company.id, [
      { storeId: a.storeA.id, role: 'MANAGER' },
    ]);
    const employee = await t.factory.member(a.company.id, [
      { storeId: a.storeA.id, role: 'EMPLOYEE' },
    ]);
    return {
      a,
      b,
      owner: await t.login(a.owner.email),
      ownerB: await t.login(b.owner.email),
      manager: await t.login(manager.user.email),
      employee: await t.login(employee.user.email),
    };
  }

  describe('isolamento entre empresas', () => {
    it('um usuário nunca acessa a empresa ou as lojas de outra, nem sabendo os ids (404)', async () => {
      const s = await scenario();
      await t.http
        .get(`/api/companies/${s.b.company.id}`)
        .set(s.owner)
        .expect(404);
      await t.http
        .get(`/api/companies/${s.b.company.id}/stores`)
        .set(s.owner)
        .expect(404);
      await t.http
        .patch(`/api/companies/${s.b.company.id}`)
        .set(s.owner)
        .send({ razaoSocial: 'Invadida' })
        .expect(404);
      await t.http
        .get(`/api/companies/${s.b.company.id}/members`)
        .set(s.owner)
        .expect(404);
      await t.http
        .post(`/api/organizations/${s.b.organization.id}/companies`)
        .set(s.owner)
        .send({})
        .expect(404);

      // o dono da B continua enxergando a própria
      await t.http
        .get(`/api/companies/${s.b.company.id}`)
        .set(s.ownerB)
        .expect(200);
    });

    it('uma loja da empresa A não é acessível pela empresa B nem via rota de company', async () => {
      const s = await scenario();
      // loja da A dentro da company da B: a loja não pertence à company
      await t.http
        .get(`/api/companies/${s.b.company.id}/stores/${s.a.storeA.id}`)
        .set(s.ownerB)
        .expect(404);
    });

    it('recurso inexistente e recurso de outro tenant respondem igual (não revela existência)', async () => {
      const s = await scenario();
      const other = await t.http
        .get(`/api/companies/${s.b.company.id}`)
        .set(s.owner)
        .expect(404);
      const ghost = await t.http
        .get('/api/companies/id-que-nao-existe')
        .set(s.owner)
        .expect(404);
      expect(other.body).toEqual(ghost.body);
    });
  });

  describe('papéis', () => {
    it('OWNER edita a empresa; MANAGER e EMPLOYEE só leem (403)', async () => {
      const s = await scenario();
      const url = `/api/companies/${s.a.company.id}`;

      await t.http
        .patch(url)
        .set(s.owner)
        .send({ nomeFantasia: 'Nova' })
        .expect(200);
      await t.http
        .patch(url)
        .set(s.manager)
        .send({ nomeFantasia: 'Hack' })
        .expect(403);
      await t.http
        .patch(url)
        .set(s.employee)
        .send({ nomeFantasia: 'Hack' })
        .expect(403);

      await t.http.get(url).set(s.manager).expect(200);
      await t.http.get(url).set(s.employee).expect(200);
    });

    it('gestão de lojas e de membros é só do OWNER', async () => {
      const s = await scenario();
      const base = `/api/companies/${s.a.company.id}`;
      await t.http
        .post(`${base}/stores`)
        .set(s.manager)
        .send({ name: 'Nova' })
        .expect(403);
      await t.http.get(`${base}/members`).set(s.manager).expect(403);
      await t.http.get(`${base}/members`).set(s.employee).expect(403);

      await t.http
        .post(`${base}/stores`)
        .set(s.owner)
        .send({ name: 'Loja C' })
        .expect(201);
      const list = await t.http.get(`${base}/members`).set(s.owner).expect(200);
      expect(list.body).toHaveLength(3);
    });

    it('só o responsável pela cobrança cria empresa na organização', async () => {
      const s = await scenario();
      const body = {
        cnpj: '11222333000181',
        razaoSocial: 'Filial',
        storeName: 'F1',
      };
      await t.http
        .post(`/api/organizations/${s.a.organization.id}/companies`)
        .set(s.manager)
        .send(body)
        .expect(403);
      await t.http
        .post(`/api/organizations/${s.a.organization.id}/companies`)
        .set(s.owner)
        .send(body)
        .expect(201);
    });

    it('um membro enxerga a empresa só se tiver acesso a alguma loja dela', async () => {
      const s = await scenario();
      const m = await t.factory.member(s.a.company.id, [
        { storeId: s.a.storeA.id, role: 'EMPLOYEE' },
      ]);
      const auth = await t.login(m.user.email);
      await t.http
        .get(`/api/companies/${s.a.company.id}`)
        .set(auth)
        .expect(200);

      // revogado de todas as lojas -> perde a empresa
      await t.http
        .delete(`/api/companies/${s.a.company.id}/members/${m.membership.id}`)
        .set(s.owner)
        .expect(200);
      await t.http
        .get(`/api/companies/${s.a.company.id}`)
        .set(auth)
        .expect(404);
    });

    it('papel é por loja: MANAGER só na loja A não acessa a loja B', async () => {
      const s = await scenario();
      const list = await t.http
        .get('/api/me/memberships')
        .set(s.manager)
        .expect(200);
      expect(
        list.body[0].stores.map((x: { storeName: string }) => x.storeName),
      ).toEqual(['Loja A']);
    });
  });

  describe('somente leitura por assinatura (nunca bloqueio total)', () => {
    const setup = async (org: Parameters<typeof t.factory.world>[0]) => {
      const w: World = await t.factory.world(org);
      const auth = await t.login(w.owner.email);
      return { w, auth, url: `/api/companies/${w.company.id}` };
    };

    it.each([
      [
        'trial no prazo',
        { subscriptionStatus: 'TRIAL', trialEndsAt: day(5) } as const,
      ],
      ['assinatura ativa', { subscriptionStatus: 'ACTIVE' } as const],
      [
        'atraso dentro da carência (2 dias)',
        { subscriptionStatus: 'PAST_DUE', pastDueSince: day(-2) } as const,
      ],
    ])('%s: acesso completo', async (_n, org) => {
      const { auth, url } = await setup(org);
      await t.http
        .patch(url)
        .set(auth)
        .send({ nomeFantasia: 'Editou' })
        .expect(200);
    });

    it.each([
      [
        'trial vencido',
        { subscriptionStatus: 'TRIAL', trialEndsAt: day(-1) } as const,
        'TRIAL_EXPIRED',
      ],
      [
        'atraso além da carência (6 dias)',
        { subscriptionStatus: 'PAST_DUE', pastDueSince: day(-6) } as const,
        'PAST_DUE',
      ],
      [
        'assinatura cancelada',
        { subscriptionStatus: 'CANCELED' } as const,
        'CANCELED',
      ],
    ])('%s: lê tudo, mas escrita responde 402', async (_n, org, reason) => {
      const { w, auth, url } = await setup(org);

      // leitura continua funcionando
      await t.http.get(url).set(auth).expect(200);
      await t.http.get(`${url}/stores`).set(auth).expect(200);
      await t.http.get(`${url}/members`).set(auth).expect(200);

      // escrita é bloqueada com código estável para o frontend
      const res = await t.http
        .patch(url)
        .set(auth)
        .send({ nomeFantasia: 'Bloqueada' })
        .expect(402);
      expect(res.body).toMatchObject({
        code: 'SUBSCRIPTION_READ_ONLY',
        reason,
      });
      await t.http
        .post(`${url}/stores`)
        .set(auth)
        .send({ name: 'Loja C' })
        .expect(402);

      // o que não é da empresa continua livre: perfil e troca de senha
      await t.http
        .patch('/api/me')
        .set(auth)
        .send({ name: 'Continua' })
        .expect(200);
      // e o aviso para o frontend mostrar o motivo
      const memberships = await t.http
        .get('/api/me/memberships')
        .set(auth)
        .expect(200);
      expect(memberships.body[0].subscription).toMatchObject({
        accessMode: 'READ_ONLY',
        reason,
      });

      // nada foi alterado
      const company = await t.prisma.company.findUniqueOrThrow({
        where: { id: w.company.id },
      });
      expect(company.nomeFantasia).toBeNull();
    });

    it('vencer a carência é por tempo: com pastDueSince de 5 dias atrás ainda tem acesso completo', async () => {
      const { auth, url } = await setup({
        subscriptionStatus: 'PAST_DUE',
        pastDueSince: new Date(Date.now() - 5 * 86_400_000 + 60_000),
      });
      await t.http
        .patch(url)
        .set(auth)
        .send({ nomeFantasia: 'Ainda dá' })
        .expect(200);
      const memberships = await t.http
        .get('/api/me/memberships')
        .set(auth)
        .expect(200);
      expect(memberships.body[0].subscription.accessMode).toBe('GRACE');
    });
  });
});
