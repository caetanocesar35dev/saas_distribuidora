import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { buildCnpj } from '../common/utils/document';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { AuthService } from '../auth/auth.service';
import { SignupDto } from '../auth/dto/auth.dto';
import { TokenService } from '../auth/token.service';
import { PlatformService } from '../platform/platform.service';
import {
  buildReferralCode,
  commissionInCents,
  isValidReferralCode,
  normalizeReferralCode,
  REFERRAL_MAX_MONTHS,
  referrerMonthsToGrant,
  remainingMonths,
} from './referral-rules';
import { ReferralsService } from './referrals.service';

describe('regras de indicação', () => {
  it('normaliza e valida o código', () => {
    expect(normalizeReferralCode(' joão-rep ')).toBe('JOAO-REP');
    expect(isValidReferralCode('JOAO-REP')).toBe(true);
    expect(isValidReferralCode('AB')).toBe(false);
    expect(isValidReferralCode('A--B')).toBe(false);
    expect(isValidReferralCode('X'.repeat(21))).toBe(false);
  });

  it('cria o código com o começo do nome', () => {
    expect(buildReferralCode('Distribuidora Zé')).toMatch(
      /^DISTRI-[A-Z2-9]{3}$/,
    );
    expect(buildReferralCode('Zé')).toMatch(/^ZEXX-/);
    expect(buildReferralCode('!!')).toMatch(/^INDICA-/);
  });

  it('acumula meses até o limite e calcula a comissão pelo plano', () => {
    expect(
      remainingMonths([
        { months: 2, monthsUsed: 1 },
        { months: 2, monthsUsed: 0 },
      ]),
    ).toBe(3);
    expect(referrerMonthsToGrant(0)).toBe(2);
    expect(referrerMonthsToGrant(REFERRAL_MAX_MONTHS - 1)).toBe(1);
    expect(referrerMonthsToGrant(REFERRAL_MAX_MONTHS)).toBe(0);
    expect(commissionInCents(34900, 50)).toBe(17450);
    expect(commissionInCents(9900, 33.33)).toBe(3300);
  });
});

describe('ReferralsService', () => {
  let ctx: ServiceTestContext;
  let referrals: ReferralsService;
  let platform: PlatformService;
  let auth: AuthService;
  let admin: { id: string };
  let n = 0;

  beforeAll(async () => {
    ctx = await createServiceTest([
      ReferralsService,
      PlatformService,
      AuthService,
      TokenService,
    ]);
    referrals = ctx.module.get(ReferralsService);
    platform = ctx.module.get(PlatformService);
    auth = ctx.module.get(AuthService);
  });
  beforeEach(async () => {
    await ctx.reset();
    admin = await ctx.factory.user({ platformRole: 'SUPERADMIN' });
    await ctx.factory.plan({ name: 'Trial', priceInCents: 0 });
  });
  afterAll(() => ctx.close());

  const as = <T>(fn: () => Promise<T>) =>
    ctx.asRequest(fn, { userId: admin.id, endpoint: 'POST /api/platform/x' });

  const signup = (over: Partial<SignupDto> = {}) => {
    n++;
    const dto: SignupDto = {
      name: 'Maria Dona',
      email: `dono${n}@dist.com`,
      password: 'Senha@123',
      cnpj: buildCnpj(String(500000000000 + n)),
      razaoSocial: `Distribuidora ${n} LTDA`,
      nomeFantasia: `Bebidas ${n}`,
      storeName: 'Matriz',
      acceptTerms: true,
      phone: '81999990000',
      ...over,
    };
    return ctx.asRequest(
      async () => {
        const result = await auth.signup(dto);
        return ctx.prisma.organization.findFirstOrThrow({
          where: { ownerUserId: result.user.id },
        });
      },
      { endpoint: 'POST /api/auth/signup' },
    );
  };

  /** A plataforma põe a assinatura em ACTIVE no plano informado: o "pagou a 1ª mensalidade". */
  const pay = (organizationId: string, planId?: string) =>
    as(() =>
      platform.updateOrganization(organizationId, {
        subscriptionStatus: 'ACTIVE',
        planId,
      }),
    );

  const codeOf = (organizationId: string) =>
    as(() => referrals.forOrganization(organizationId)).then((r) => r.code);

  const newRep = (over: { code?: string; commissionPercent?: number } = {}) =>
    as(() =>
      referrals.createRepresentative({
        name: 'João Representante',
        phone: '81988887777',
        pixKey: 'joao@pix.com',
        commissionPercent: 50,
        ...over,
      }),
    );

  describe('Indique e ganhe (responsável pela assinatura)', () => {
    it('cria o código na primeira vez e devolve sempre o mesmo', async () => {
      const org = await signup();
      const first = await as(() => referrals.forOrganization(org.id));
      expect(first.code).toMatch(/^BEBIDA-/);
      expect(await codeOf(org.id)).toBe(first.code);
      expect(first).toMatchObject({
        remainingMonths: 0,
        referrals: [],
        referredBy: null,
        rules: { discountPercent: 20, discountMonths: 2, maxMonths: 12 },
      });
    });

    it('organização inexistente → 404', async () => {
      await expect(
        as(() => referrals.forOrganization('nao-existe')),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cadastro com código', () => {
    it('código de cliente: indicação pendente e desconto já visível para o indicado', async () => {
      const referrer = await signup();
      const code = await codeOf(referrer.id);
      const referred = await signup({ referralCode: code.toLowerCase() });

      const referral = await ctx.prisma.referral.findFirstOrThrow({
        where: { referredOrganizationId: referred.id },
      });
      expect(referral).toMatchObject({
        code,
        status: 'PENDING',
        referrerOrganizationId: referrer.id,
        representativeId: null,
      });

      const view = await as(() => referrals.forOrganization(referred.id));
      expect(view.remainingMonths).toBe(2);
      expect(view.referredBy).toMatchObject({ code, status: 'PENDING' });
      expect(view.discounts).toEqual([
        expect.objectContaining({
          reason: 'REFERRED',
          percent: 20,
          months: 2,
          from: referrer.name,
        }),
      ]);

      // Quem indicou só ganha quando o indicado pagar.
      const referrerView = await as(() =>
        referrals.forOrganization(referrer.id),
      );
      expect(referrerView.remainingMonths).toBe(0);
      expect(referrerView.referrals).toEqual([
        expect.objectContaining({
          organizationName: referred.name,
          status: 'PENDING',
        }),
      ]);
    });

    it('código de representante também dá desconto ao indicado', async () => {
      const rep = await newRep({ code: 'JOAO-REP' });
      const referred = await signup({ referralCode: 'joao-rep' });
      const referral = await ctx.prisma.referral.findFirstOrThrow({
        where: { referredOrganizationId: referred.id },
      });
      expect(referral.representativeId).toBe(rep.id);
      const view = await as(() => referrals.forOrganization(referred.id));
      expect(view.remainingMonths).toBe(2);
      expect(view.discounts[0].from).toBe('João Representante');
    });

    it('código desconhecido ou de representante excluído → 400, sem criar a conta', async () => {
      await expect(signup({ referralCode: 'NAO-EXISTE' })).rejects.toThrow(
        BadRequestException,
      );
      const rep = await newRep({ code: 'SAIU-REP' });
      await as(() => referrals.removeRepresentative(rep.id));
      await expect(signup({ referralCode: 'SAIU-REP' })).rejects.toThrow(
        /não encontrado/,
      );
      expect(await ctx.prisma.organization.count()).toBe(0);
    });
  });

  describe('confirmação quando o indicado paga', () => {
    it('cliente que indicou ganha o desconto; confirmar de novo não duplica', async () => {
      const referrer = await signup();
      const referred = await signup({
        referralCode: await codeOf(referrer.id),
      });

      await pay(referred.id);
      await pay(referred.id);

      const referral = await ctx.prisma.referral.findFirstOrThrow({
        where: { referredOrganizationId: referred.id },
      });
      expect(referral.status).toBe('CONFIRMED');
      expect(referral.confirmedAt).toBeInstanceOf(Date);
      expect(referral.commissionInCents).toBeNull();

      const view = await as(() => referrals.forOrganization(referrer.id));
      expect(view.remainingMonths).toBe(2);
      expect(view.discounts).toEqual([
        expect.objectContaining({ reason: 'REFERRER', from: referred.name }),
      ]);

      // e-mail para quem indicou, uma vez só (a segunda confirmação não faz nada)
      const owner = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: referrer.ownerUserId },
      });
      const rewards = ctx.mail
        .sentTo(owner.email)
        .filter((m) => m.subject.startsWith('Você ganhou'));
      expect(rewards).toHaveLength(1);
      expect(rewards[0].subject).toContain('2 meses com 20% de desconto');
      expect(rewards[0].text).toContain(referred.name);
    });

    it('não confirma enquanto a assinatura não fica ativa', async () => {
      const referrer = await signup();
      const referred = await signup({
        referralCode: await codeOf(referrer.id),
      });
      await as(() =>
        platform.updateOrganization(referred.id, {
          subscriptionStatus: 'PAST_DUE',
        }),
      );
      const referral = await ctx.prisma.referral.findFirstOrThrow({
        where: { referredOrganizationId: referred.id },
      });
      expect(referral.status).toBe('PENDING');
    });

    it('os descontos de quem indica se acumulam até o limite', async () => {
      const referrer = await signup();
      const code = await codeOf(referrer.id);
      for (let i = 0; i < 7; i++) {
        const referred = await signup({ referralCode: code });
        await pay(referred.id);
      }
      const view = await as(() => referrals.forOrganization(referrer.id));
      expect(view.remainingMonths).toBe(REFERRAL_MAX_MONTHS);
      expect(
        view.referrals.filter((r) => r.status === 'CONFIRMED'),
      ).toHaveLength(7);

      const last = await ctx.prisma.referral.findFirstOrThrow({
        where: { referrerOrganizationId: referrer.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(last.note).toMatch(/limite/);
    });

    it('representante: comissão proporcional ao plano do indicado na confirmação', async () => {
      await newRep({ code: 'ANA-REP', commissionPercent: 50 });
      const pro = await ctx.factory.plan({
        name: 'Profissional',
        priceInCents: 34900,
      });
      const referred = await signup({ referralCode: 'ANA-REP' });
      await pay(referred.id, pro.id);

      const referral = await ctx.prisma.referral.findFirstOrThrow({
        where: { referredOrganizationId: referred.id },
      });
      expect(referral).toMatchObject({
        status: 'CONFIRMED',
        confirmedPlanId: pro.id,
        confirmedPlanPriceInCents: 34900,
        commissionInCents: 17450,
        commissionPaidAt: null,
      });
    });
  });

  describe('plataforma', () => {
    it('representantes: código próprio ou gerado, único entre clientes e representantes', async () => {
      const generated = await newRep();
      expect(generated.code).toMatch(/^JOAORE-/);

      await newRep({ code: 'PEDRO-REP' });
      await expect(newRep({ code: 'pedro-rep' })).rejects.toBeInstanceOf(
        ConflictException,
      );

      const org = await signup();
      const orgCode = await codeOf(org.id);
      await expect(newRep({ code: orgCode })).rejects.toThrow(/em uso/);

      // O próprio código ao editar não conta como repetido.
      await expect(
        as(() =>
          referrals.updateRepresentative(generated.id, {
            code: generated.code,
            commissionPercent: 30,
          }),
        ),
      ).resolves.toMatchObject({ commissionPercent: 30 });
    });

    it('exclui, lista os excluídos e reativa o representante', async () => {
      const rep = await newRep({ code: 'BETO-REP' });
      await as(() => referrals.removeRepresentative(rep.id));
      expect(await referrals.listRepresentatives()).toHaveLength(0);
      const deleted = await referrals.listRepresentatives(true);
      expect(deleted.map((r) => r.id)).toEqual([rep.id]);
      // O código continua reservado.
      await expect(newRep({ code: 'BETO-REP' })).rejects.toThrow(/em uso/);
      await as(() => referrals.restoreRepresentative(rep.id));
      expect((await referrals.listRepresentatives()).map((r) => r.id)).toEqual([
        rep.id,
      ]);
    });

    it('marca a comissão como paga só depois da confirmação, e uma vez só', async () => {
      const rep = await newRep({ code: 'CAIO-REP' });
      const plan = await ctx.factory.plan({ priceInCents: 9900 });
      const referred = await signup({ referralCode: 'CAIO-REP' });
      const { id } = await ctx.prisma.referral.findFirstOrThrow({
        where: { referredOrganizationId: referred.id },
      });

      await expect(as(() => referrals.markCommissionPaid(id))).rejects.toThrow(
        /1ª mensalidade/,
      );
      await pay(referred.id, plan.id);

      const paid = await as(() =>
        referrals.markCommissionPaid(id, 'Pix 30/10'),
      );
      expect(paid.commissionPaidAt).toBeInstanceOf(Date);
      expect(paid.commissionNote).toBe('Pix 30/10');
      await expect(as(() => referrals.markCommissionPaid(id))).rejects.toThrow(
        /já foi paga/,
      );

      const [listed] = await referrals.listRepresentatives();
      expect(listed).toMatchObject({
        id: rep.id,
        confirmed: 1,
        paidInCents: 4950,
        toPayInCents: 0,
      });
    });

    it('comissão de indicação de cliente não existe', async () => {
      const referrer = await signup();
      const referred = await signup({
        referralCode: await codeOf(referrer.id),
      });
      await pay(referred.id);
      const { id } = await ctx.prisma.referral.findFirstOrThrow({
        where: { referredOrganizationId: referred.id },
      });
      await expect(as(() => referrals.markCommissionPaid(id))).rejects.toThrow(
        /representante/,
      );
    });

    it('cancela a indicação: os descontos não usados deixam de valer', async () => {
      const referrer = await signup();
      const referred = await signup({
        referralCode: await codeOf(referrer.id),
      });
      await pay(referred.id);
      const { id } = await ctx.prisma.referral.findFirstOrThrow({
        where: { referredOrganizationId: referred.id },
      });

      const canceled = await as(() =>
        referrals.cancelReferral(id, 'Conta duplicada'),
      );
      expect(canceled).toMatchObject({
        status: 'CANCELED',
        note: 'Conta duplicada',
      });
      expect(
        (await as(() => referrals.forOrganization(referrer.id)))
          .remainingMonths,
      ).toBe(0);
      expect(
        (await as(() => referrals.forOrganization(referred.id)))
          .remainingMonths,
      ).toBe(0);
      await expect(
        as(() => referrals.cancelReferral(id, 'de novo')),
      ).rejects.toThrow(/já está cancelada/);
    });

    it('lista com filtros e monta o painel', async () => {
      const rep = await newRep({ code: 'LUIZ-REP', commissionPercent: 10 });
      const plan = await ctx.factory.plan({ priceInCents: 17900 });
      const referrer = await signup();
      const viaCustomer = await signup({
        referralCode: await codeOf(referrer.id),
      });
      const viaRep = await signup({ referralCode: 'LUIZ-REP' });
      await pay(viaRep.id, plan.id);

      const page = { page: 1, limit: 20 };
      const all = await referrals.listReferrals(page);
      expect(all.meta.totalItems).toBe(2);
      const fromRep = await referrals.listReferrals({
        ...page,
        source: 'REPRESENTATIVE',
      });
      expect(fromRep.data.map((r) => r.referredOrganization.id)).toEqual([
        viaRep.id,
      ]);
      const toPay = await referrals.listReferrals({
        ...page,
        commission: 'TO_PAY',
      });
      expect(toPay.data).toHaveLength(1);
      const search = await referrals.listReferrals({
        ...page,
        search: viaCustomer.name,
      });
      expect(search.data.map((r) => r.referredOrganization.id)).toEqual([
        viaCustomer.id,
      ]);

      const summary = await referrals.summary();
      expect(summary.totals).toMatchObject({
        all: 2,
        pending: 1,
        confirmed: 1,
        fromCustomers: 1,
        fromRepresentatives: 1,
      });
      expect(summary.commissions).toMatchObject({ toPayInCents: 1790 });
      expect(summary.representatives).toEqual([
        expect.objectContaining({
          id: rep.id,
          confirmed: 1,
          toPayInCents: 1790,
        }),
      ]);
      expect(summary.topCustomers).toEqual([
        expect.objectContaining({
          organizationId: referrer.id,
          referrals: 1,
          confirmed: 0,
        }),
      ]);
      // Os dois indicados têm 2 meses cada; quem indicou ainda não ganhou (indicado não pagou).
      expect(summary.discounts.map((d) => d.organizationId).sort()).toEqual(
        [viaCustomer.id, viaRep.id].sort(),
      );
    });

    it('o detalhe da organização mostra quem indicou e os meses de desconto', async () => {
      const rep = await newRep({ code: 'RITA-REP' });
      const referred = await signup({ referralCode: 'RITA-REP' });
      const detail = await platform.getOrganization(referred.id);
      expect(detail.referredBy).toMatchObject({
        code: 'RITA-REP',
        status: 'PENDING',
        representative: { id: rep.id },
      });
      expect(detail.discountRemainingMonths).toBe(2);
      expect(detail.referralsMade).toBe(0);
    });
  });
});
