import { createTestApp, TestApp } from './helpers/app';

describe('Plataforma e notificações pela API (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => t.reset());
  afterAll(() => t.close());

  async function scenario() {
    const superadmin = await t.factory.user({ platformRole: 'SUPERADMIN' });
    const support = await t.factory.user({ platformRole: 'SUPPORT' });
    const w = await t.factory.world();
    return {
      w,
      superadmin: await t.login(superadmin.email),
      support: await t.login(support.email),
      owner: await t.login(w.owner.email),
      superadminId: superadmin.id,
    };
  }

  describe('permissões da plataforma', () => {
    it('usuário comum (dono de empresa) não acessa /platform: 403', async () => {
      const s = await scenario();
      for (const path of [
        '/plans',
        '/organizations',
        '/users',
        '/notifications',
      ]) {
        await t.http.get(`/api/platform${path}`).set(s.owner).expect(403);
      }
      await t.http.get('/api/platform/plans').expect(401);
    });

    it('SUPPORT só lê; SUPERADMIN lê e escreve', async () => {
      const s = await scenario();
      await t.http.get('/api/platform/plans').set(s.support).expect(200);
      await t.http
        .get('/api/platform/organizations')
        .set(s.support)
        .expect(200);
      await t.http.get('/api/platform/users').set(s.support).expect(200);

      const body = { name: 'Pro', priceInCents: 9900 };
      await t.http
        .post('/api/platform/plans')
        .set(s.support)
        .send(body)
        .expect(403);
      await t.http
        .patch(`/api/platform/organizations/${s.w.organization.id}`)
        .set(s.support)
        .send({ subscriptionStatus: 'CANCELED' })
        .expect(403);
      await t.http
        .patch(`/api/platform/users/${s.w.owner.id}/active`)
        .set(s.support)
        .send({ isActive: false })
        .expect(403);
      await t.http
        .post('/api/platform/notifications')
        .set(s.support)
        .send({ title: 'x', body: 'y' })
        .expect(403);

      await t.http
        .post('/api/platform/plans')
        .set(s.superadmin)
        .send(body)
        .expect(201);
    });

    it('a plataforma NÃO acessa os dados das distribuidoras pelas rotas de tenant (404)', async () => {
      const s = await scenario();
      await t.http
        .get(`/api/companies/${s.w.company.id}`)
        .set(s.superadmin)
        .expect(404);
      await t.http
        .get(`/api/stores/${s.w.storeA.id}/sales`)
        .set(s.superadmin)
        .expect(404);
    });

    it('rotas com :id da plataforma funcionam mesmo o admin não sendo membro de nada', async () => {
      const s = await scenario();
      const res = await t.http
        .get(`/api/platform/organizations/${s.w.organization.id}`)
        .set(s.support)
        .expect(200);
      expect(res.body.id).toBe(s.w.organization.id);
    });
  });

  describe('operação', () => {
    it('SUPERADMIN coloca a organização em atraso e ela vira somente leitura depois da carência', async () => {
      const s = await scenario();
      const url = `/api/companies/${s.w.company.id}`;

      await t.http
        .patch(url)
        .set(s.owner)
        .send({ nomeFantasia: 'Antes' })
        .expect(200);

      await t.http
        .patch(`/api/platform/organizations/${s.w.organization.id}`)
        .set(s.superadmin)
        .send({
          subscriptionStatus: 'PAST_DUE',
          pastDueSince: new Date(Date.now() - 8 * 86_400_000).toISOString(),
        })
        .expect(200);
      await t.http
        .patch(url)
        .set(s.owner)
        .send({ nomeFantasia: 'Depois' })
        .expect(402);

      // cortesia: limpa o atraso e volta ao normal
      await t.http
        .patch(`/api/platform/organizations/${s.w.organization.id}`)
        .set(s.superadmin)
        .send({ subscriptionStatus: 'ACTIVE' })
        .expect(200);
      await t.http
        .patch(url)
        .set(s.owner)
        .send({ nomeFantasia: 'Depois' })
        .expect(200);
    });

    it('desativar usuário bloqueia o acesso na hora', async () => {
      const s = await scenario();
      await t.http.get('/api/me').set(s.owner).expect(200);
      await t.http
        .patch(`/api/platform/users/${s.w.owner.id}/active`)
        .set(s.superadmin)
        .send({ isActive: false })
        .expect(200);
      await t.http.get('/api/me').set(s.owner).expect(401);
      await t.http
        .post('/api/auth/refresh')
        .send({ refreshToken: s.owner.refresh })
        .expect(401);
      await t.http
        .post('/api/auth/login')
        .send({ email: s.w.owner.email, password: 'Senha@123' })
        .expect(401);
    });

    it('valida os dados: plano sem preço, status inválido, desativar a si mesmo', async () => {
      const s = await scenario();
      await t.http
        .post('/api/platform/plans')
        .set(s.superadmin)
        .send({ name: 'X' })
        .expect(400);
      await t.http
        .patch(`/api/platform/organizations/${s.w.organization.id}`)
        .set(s.superadmin)
        .send({ subscriptionStatus: 'QUEBRADO' })
        .expect(400);
      await t.http
        .patch(`/api/platform/users/${s.superadminId}/active`)
        .set(s.superadmin)
        .send({ isActive: false })
        .expect(409);
    });
  });

  describe('notificações', () => {
    it('SUPERADMIN publica, o usuário vê, marca como lida e o contador cai', async () => {
      const s = await scenario();
      const created = await t.http
        .post('/api/platform/notifications')
        .set(s.superadmin)
        .send({
          title: 'Manutenção',
          body: 'Sábado às 22h',
          type: 'MAINTENANCE',
        })
        .expect(201);

      expect(
        (
          await t.http
            .get('/api/me/notifications/unread-count')
            .set(s.owner)
            .expect(200)
        ).body,
      ).toEqual({ count: 1 });
      const list = await t.http
        .get('/api/me/notifications')
        .set(s.owner)
        .expect(200);
      expect(list.body.data[0]).toMatchObject({
        title: 'Manutenção',
        type: 'MAINTENANCE',
        read: false,
      });

      await t.http
        .post(`/api/me/notifications/${created.body.id}/read`)
        .set(s.owner)
        .expect(200);
      await t.http
        .post(`/api/me/notifications/${created.body.id}/read`)
        .set(s.owner)
        .expect(200); // idempotente
      expect(
        (await t.http.get('/api/me/notifications/unread-count').set(s.owner))
          .body,
      ).toEqual({ count: 0 });
      expect(
        (await t.http.get('/api/me/notifications?unread=true').set(s.owner))
          .body.data,
      ).toHaveLength(0);
      expect(
        (await t.http.get('/api/me/notifications').set(s.owner)).body.data[0]
          .read,
      ).toBe(true);
    });

    it('notificação agendada só aparece quando chega a hora, e a leitura não vaza entre usuários', async () => {
      const s = await scenario();
      await t.http
        .post('/api/platform/notifications')
        .set(s.superadmin)
        .send({
          title: 'Futura',
          body: 'x',
          publishedAt: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect(201);
      expect(
        (await t.http.get('/api/me/notifications').set(s.owner)).body.data,
      ).toHaveLength(0);
      const all = await t.http
        .get('/api/platform/notifications')
        .set(s.support)
        .expect(200);
      expect(all.body.data).toHaveLength(1);
      await t.http
        .post(`/api/me/notifications/${all.body.data[0].id}/read`)
        .set(s.owner)
        .expect(404);
    });

    it('qualquer usuário autenticado lê as próprias; sem token, 401', async () => {
      await t.http.get('/api/me/notifications').expect(401);
      await t.http.post('/api/me/notifications/x/read').expect(401);
    });
  });
});
