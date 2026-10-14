import { resolveAccessMode } from './access-mode';

const NOW = new Date('2026-10-20T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const GRACE = 5;

describe('resolveAccessMode', () => {
  it('ACTIVE tem acesso completo', () => {
    const r = resolveAccessMode(
      { subscriptionStatus: 'ACTIVE', trialEndsAt: null, pastDueSince: null },
      NOW,
      GRACE,
    );
    expect(r).toMatchObject({ accessMode: 'FULL', reason: null });
  });

  it('TRIAL dentro do prazo: completo', () => {
    const r = resolveAccessMode(
      { subscriptionStatus: 'TRIAL', trialEndsAt: day(3), pastDueSince: null },
      NOW,
      GRACE,
    );
    expect(r.accessMode).toBe('FULL');
  });

  it('TRIAL vencido: somente leitura', () => {
    const r = resolveAccessMode(
      { subscriptionStatus: 'TRIAL', trialEndsAt: day(-1), pastDueSince: null },
      NOW,
      GRACE,
    );
    expect(r).toMatchObject({
      accessMode: 'READ_ONLY',
      reason: 'TRIAL_EXPIRED',
    });
  });

  it('TRIAL sem data de fim não bloqueia', () => {
    const r = resolveAccessMode(
      { subscriptionStatus: 'TRIAL', trialEndsAt: null, pastDueSince: null },
      NOW,
      GRACE,
    );
    expect(r.accessMode).toBe('FULL');
  });

  describe('PAST_DUE', () => {
    const past = (days: number) => ({
      subscriptionStatus: 'PAST_DUE' as const,
      trialEndsAt: null,
      pastDueSince: day(-days),
    });

    it('atraso de 1 dia: carência (acesso completo com aviso)', () => {
      const r = resolveAccessMode(past(1), NOW, GRACE);
      expect(r.accessMode).toBe('GRACE');
      expect(r.graceEndsAt?.getTime()).toBe(day(-1 + GRACE).getTime());
    });

    it('exatamente no fim da carência ainda é carência', () => {
      expect(resolveAccessMode(past(5), NOW, GRACE).accessMode).toBe('GRACE');
    });

    it('um instante depois da carência: somente leitura', () => {
      const r = resolveAccessMode(
        {
          subscriptionStatus: 'PAST_DUE',
          trialEndsAt: null,
          pastDueSince: new Date(day(-5).getTime() - 1),
        },
        NOW,
        GRACE,
      );
      expect(r).toMatchObject({ accessMode: 'READ_ONLY', reason: 'PAST_DUE' });
    });

    it('atraso de 10 dias: somente leitura', () => {
      expect(resolveAccessMode(past(10), NOW, GRACE).accessMode).toBe(
        'READ_ONLY',
      );
    });

    it('sem pastDueSince não dá para contar a carência e não bloqueia', () => {
      const r = resolveAccessMode(
        {
          subscriptionStatus: 'PAST_DUE',
          trialEndsAt: null,
          pastDueSince: null,
        },
        NOW,
        GRACE,
      );
      expect(r.accessMode).toBe('GRACE');
    });

    it('respeita carência configurável', () => {
      expect(resolveAccessMode(past(2), NOW, 0).accessMode).toBe('READ_ONLY');
      expect(resolveAccessMode(past(2), NOW, 30).accessMode).toBe('GRACE');
    });
  });

  it('CANCELED: somente leitura', () => {
    const r = resolveAccessMode(
      { subscriptionStatus: 'CANCELED', trialEndsAt: null, pastDueSince: null },
      NOW,
      GRACE,
    );
    expect(r).toMatchObject({ accessMode: 'READ_ONLY', reason: 'CANCELED' });
  });
});
