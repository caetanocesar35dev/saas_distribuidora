import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { buildCnpj } from '../common/utils/document';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { DEFAULT_PASSWORD } from '../../test/helpers/factory';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/auth.dto';
import { TokenService } from './token.service';

describe('AuthService', () => {
  let ctx: ServiceTestContext;
  let auth: AuthService;
  let tokens: TokenService;

  beforeAll(async () => {
    ctx = await createServiceTest([AuthService, TokenService]);
    auth = ctx.module.get(AuthService);
    tokens = ctx.module.get(TokenService);
  });
  beforeEach(() => ctx.reset());
  afterAll(() => ctx.close());

  const signupDto = (over: Partial<SignupDto> = {}): SignupDto => ({
    name: 'Maria Dona',
    email: 'maria@dist.com',
    password: 'Senha@123',
    cnpj: buildCnpj('111222330001'),
    razaoSocial: 'Maria Distribuidora LTDA',
    nomeFantasia: 'Maria Bebidas',
    storeName: 'Matriz',
    ...over,
  });

  const signup = (over: Partial<SignupDto> = {}) =>
    ctx.asRequest(() => auth.signup(signupDto(over)), {
      endpoint: 'POST /api/auth/signup',
    });
  const login = (email: string, password = DEFAULT_PASSWORD) =>
    ctx.asRequest(() => auth.login({ email, password }), {
      endpoint: 'POST /api/auth/login',
    });
  const refresh = (token: string) =>
    ctx.asRequest(() => auth.refresh(token), {
      endpoint: 'POST /api/auth/refresh',
    });

  describe('signup', () => {
    beforeEach(async () => {
      await ctx.factory.plan({ name: 'Trial', priceInCents: 0 });
    });

    it('cria usuário, organização em trial, company, loja e vínculo OWNER numa transação', async () => {
      const result = await signup();

      expect(result.user).toMatchObject({
        email: 'maria@dist.com',
        name: 'Maria Dona',
      });
      expect(result.access_token).toBeTruthy();
      expect(result.refresh_token).toBeTruthy();

      const org = await ctx.prisma.organization.findFirstOrThrow({
        where: { ownerUserId: result.user.id },
      });
      expect(org.subscriptionStatus).toBe('TRIAL');
      expect(org.billingEmail).toBe('maria@dist.com');
      const days = (org.trialEndsAt!.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(13.9);
      expect(days).toBeLessThan(14.1);

      const access = await ctx.prisma.membershipStore.findMany({
        where: { membership: { userId: result.user.id } },
        include: { store: true },
      });
      expect(access).toHaveLength(1);
      expect(access[0]).toMatchObject({ role: 'OWNER' });
      expect(access[0].store.name).toBe('Matriz');
    });

    it('a auditoria do cadastro atribui tudo ao próprio usuário criado', async () => {
      const result = await signup();
      const stores = await ctx.prisma.storeHistory.findMany();
      const orgs = await ctx.prisma.organizationHistory.findMany();
      expect(stores[0].modifierId).toBe(result.user.id);
      expect(orgs[0].modifierId).toBe(result.user.id);
      expect(stores[0].modifiedEndpoint).toBe('POST /api/auth/signup');
    });

    it('usa o plano informado ou, sem plano, o mais barato', async () => {
      const pro = await ctx.factory.plan({ name: 'Pro', priceInCents: 19900 });
      const cheap = await signup({
        email: 'a@a.com',
        cnpj: buildCnpj('555000000001'),
      });
      const picked = await signup({
        email: 'b@b.com',
        cnpj: buildCnpj('555000000002'),
        planId: pro.id,
      });
      const orgCheap = await ctx.prisma.organization.findFirstOrThrow({
        where: { ownerUserId: cheap.user.id },
        include: { plan: true },
      });
      const orgPicked = await ctx.prisma.organization.findFirstOrThrow({
        where: { ownerUserId: picked.user.id },
      });
      expect(orgCheap.plan.name).toBe('Trial');
      expect(orgPicked.planId).toBe(pro.id);
    });

    it('rejeita e-mail e CNPJ repetidos', async () => {
      await signup();
      await expect(
        signup({ cnpj: buildCnpj('999888770001') }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(signup({ email: 'outra@dist.com' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejeita CNPJ inválido e plano inexistente', async () => {
      await expect(
        signup({ cnpj: '11.222.333/0001-99' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(signup({ planId: 'nao-existe' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('não deixa nada pela metade se a transação falhar', async () => {
      // A transação executa todas as criações e falha no fim: nada pode ter ficado gravado.
      const original = ctx.prisma.$transaction.bind(ctx.prisma);
      const spy = jest
        .spyOn(ctx.prisma, '$transaction')
        .mockImplementationOnce(((fn: any) =>
          original(async (tx: any) => {
            await fn(tx);
            throw new Error('boom');
          })) as any);
      await expect(signup()).rejects.toThrow('boom');
      spy.mockRestore();

      expect(await ctx.prisma.user.count()).toBe(0);
      expect(await ctx.prisma.organization.count()).toBe(0);
      expect(await ctx.prisma.company.count()).toBe(0);
      expect(await ctx.prisma.store.count()).toBe(0);
      expect(await ctx.prisma.membershipStore.count()).toBe(0);
    });
  });

  describe('login', () => {
    it('autentica com e-mail e senha corretos', async () => {
      const user = await ctx.factory.user({ email: 'ana@teste.com' });
      const result = await login('ana@teste.com');
      expect(result.user.id).toBe(user.id);
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(900);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('usa a mesma mensagem para senha errada, e-mail inexistente e usuário inativo', async () => {
      await ctx.factory.user({ email: 'ana@teste.com' });
      await ctx.factory.user({ email: 'inativo@teste.com', isActive: false });
      const messages = await Promise.all(
        [
          login('ana@teste.com', 'errada'),
          login('naoexiste@teste.com'),
          login('inativo@teste.com'),
        ].map((p) => p.catch((e: UnauthorizedException) => e.message)),
      );
      expect(new Set(messages).size).toBe(1);
      expect(messages[0]).toBe('E-mail ou senha incorretos.');
    });

    it('não autentica usuário excluído (soft delete)', async () => {
      const user = await ctx.factory.user({ email: 'del@teste.com' });
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.user.update({
          where: { id: user.id },
          data: { deletedAt: new Date() },
        }),
      );
      await expect(login('del@teste.com')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('guarda só o hash do refresh token, nunca o token', async () => {
      await ctx.factory.user({ email: 'ana@teste.com' });
      const result = await login('ana@teste.com');
      const stored = await ctx.prisma.refreshToken.findFirstOrThrow();
      expect(stored.tokenHash).not.toBe(result.refresh_token);
      expect(stored.tokenHash).toBe(tokens.hash(result.refresh_token));
      expect(stored.modifierId).toBe(result.user.id);
    });

    it('o histórico do refresh token não expõe o hash', async () => {
      await ctx.factory.user({ email: 'ana@teste.com' });
      await login('ana@teste.com');
      const history = await ctx.prisma.refreshTokenHistory.findFirstOrThrow();
      expect(history).not.toHaveProperty('tokenHash');
    });
  });

  describe('refresh token com rotação', () => {
    let email: string;
    beforeEach(async () => {
      email = (await ctx.factory.user()).email;
    });

    it('troca o refresh token por um novo par e revoga o anterior', async () => {
      const first = await login(email);
      const second = await refresh(first.refresh_token);

      expect(second.refresh_token).not.toBe(first.refresh_token);
      expect(second.access_token).toBeTruthy();

      const old = await ctx.prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: tokens.hash(first.refresh_token) },
      });
      expect(old.revokedAt).not.toBeNull();
      const fresh = await ctx.prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: tokens.hash(second.refresh_token) },
      });
      expect(old.replacedById).toBe(fresh.id);
      expect(fresh.familyId).toBe(old.familyId);
    });

    it('permite encadear várias rotações', async () => {
      let session = await login(email);
      for (let i = 0; i < 3; i++)
        session = { ...session, ...(await refresh(session.refresh_token)) };
      expect(
        await ctx.prisma.refreshToken.count({ where: { revokedAt: null } }),
      ).toBe(1);
    });

    it('detecta reuso: apresentar um token já usado derruba a sessão inteira', async () => {
      const first = await login(email);
      const second = await refresh(first.refresh_token);

      await expect(refresh(first.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // o token novo (da mesma família) também foi revogado
      await expect(refresh(second.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('reuso numa sessão não afeta as outras sessões do mesmo usuário', async () => {
      const deviceA = await login(email);
      const deviceB = await login(email);
      const a2 = await refresh(deviceA.refresh_token);
      await expect(refresh(deviceA.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(a2.refresh_token).toBeTruthy();
      await expect(refresh(deviceB.refresh_token)).resolves.toBeTruthy();
    });

    it('rejeita token inexistente e token expirado', async () => {
      await expect(refresh('token-que-nao-existe')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      const session = await login(email);
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.refreshToken.updateMany({
          data: { expiresAt: new Date(Date.now() - 1000) },
        }),
      );
      await expect(refresh(session.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('não renova sessão de usuário desativado', async () => {
      const session = await login(email);
      await ctx.audit.runAsSystem('seed', () =>
        ctx.prisma.user.updateMany({
          where: { email },
          data: { isActive: false },
        }),
      );
      await expect(refresh(session.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('duas renovações simultâneas do mesmo token: só uma vence', async () => {
      const session = await login(email);
      const results = await Promise.allSettled([
        refresh(session.refresh_token),
        refresh(session.refresh_token),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });
  });

  describe('logout', () => {
    it('revoga a sessão do refresh token e é idempotente', async () => {
      const user = await ctx.factory.user();
      const session = await login(user.email);
      await ctx.asRequest(() => auth.logout(session.refresh_token), {
        endpoint: 'POST /api/auth/logout',
      });
      await expect(refresh(session.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        ctx.asRequest(() => auth.logout(session.refresh_token), {
          endpoint: 'POST /api/auth/logout',
        }),
      ).resolves.toBeTruthy();
      await expect(
        ctx.asRequest(() => auth.logout('inexistente'), {
          endpoint: 'POST /api/auth/logout',
        }),
      ).resolves.toBeTruthy();
    });

    it('logout-all encerra todas as sessões do usuário', async () => {
      const user = await ctx.factory.user();
      const a = await login(user.email);
      const b = await login(user.email);
      await ctx.asRequest(() => auth.logoutAll(user.id), {
        userId: user.id,
        endpoint: 'POST /api/auth/logout-all',
      });
      await expect(refresh(a.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(refresh(b.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('troca de senha', () => {
    it('exige a senha atual, encerra as outras sessões e devolve uma sessão nova', async () => {
      const user = await ctx.factory.user();
      const old = await login(user.email);

      await expect(
        ctx.asRequest(
          () =>
            auth.changePassword(user.id, {
              currentPassword: 'errada',
              newPassword: 'NovaSenha@1',
            }),
          {
            userId: user.id,
          },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const fresh = await ctx.asRequest(
        () =>
          auth.changePassword(user.id, {
            currentPassword: DEFAULT_PASSWORD,
            newPassword: 'NovaSenha@1',
          }),
        { userId: user.id, endpoint: 'POST /api/auth/change-password' },
      );
      await expect(refresh(old.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(refresh(fresh.refresh_token)).resolves.toBeTruthy();
      await expect(login(user.email, DEFAULT_PASSWORD)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(login(user.email, 'NovaSenha@1')).resolves.toBeTruthy();
    });
  });

  describe('esqueci a senha', () => {
    it('envia o link para quem existe e responde igual para quem não existe', async () => {
      const user = await ctx.factory.user({ email: 'ana@teste.com' });
      const known = await ctx.asRequest(() =>
        auth.forgotPassword('ana@teste.com'),
      );
      const unknown = await ctx.asRequest(() =>
        auth.forgotPassword('fantasma@teste.com'),
      );

      expect(known).toEqual(unknown);
      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0].to).toBe(user.email);
      expect(ctx.mail.lastLinkTo('ana@teste.com')).toContain(
        '/redefinir-senha?token=',
      );
    });

    it('não envia para usuário inativo', async () => {
      await ctx.factory.user({ email: 'off@teste.com', isActive: false });
      await ctx.asRequest(() => auth.forgotPassword('off@teste.com'));
      expect(ctx.mail.sent).toHaveLength(0);
    });

    const tokenFromMail = (email: string) =>
      decodeURIComponent(ctx.mail.lastLinkTo(email)!.split('token=')[1]);

    it('redefine a senha com o link, uma única vez, e encerra as sessões', async () => {
      const user = await ctx.factory.user({ email: 'ana@teste.com' });
      const session = await login(user.email);
      await ctx.asRequest(() => auth.forgotPassword('ana@teste.com'));
      const token = tokenFromMail('ana@teste.com');

      await ctx.asRequest(
        () => auth.resetPassword({ token, newPassword: 'Redefinida@1' }),
        {
          endpoint: 'POST /api/auth/reset-password',
        },
      );
      await expect(login(user.email, 'Redefinida@1')).resolves.toBeTruthy();
      await expect(refresh(session.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      // o mesmo link não funciona de novo (o hash da senha mudou)
      await expect(
        ctx.asRequest(() =>
          auth.resetPassword({ token, newPassword: 'Outra@12345' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita token adulterado, expirado ou de outro tipo', async () => {
      const user = await ctx.factory.user();
      const jwt = ctx.module.get(JwtService);
      const accessToken = await jwt.signAsync({ sub: user.id, typ: 'access' });
      const expired = await tokens.signPasswordToken(
        { id: user.id, passwordHash: user.passwordHash },
        '30m',
      );
      const bad = [
        'lixo',
        accessToken,
        expired.slice(0, -4) + 'AAAA',
        await jwt.signAsync(
          { sub: user.id, typ: 'reset' },
          { secret: 'outro-segredo' },
        ),
      ];
      for (const token of bad) {
        await expect(
          ctx.asRequest(() =>
            auth.resetPassword({ token, newPassword: 'Redefinida@1' }),
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    });
  });
});
