import { ean13CheckDigit, generateEan13, isValidEan13 } from './ean13';
import { fromCents, roundMoney, toCents } from './money';
import {
  addDays,
  formatDayInTz,
  startOfDayInTz,
  startOfMonthInTz,
} from './time';

describe('money', () => {
  it('arredonda para 2 casas sem erro de ponto flutuante', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(10.555)).toBe(10.56);
  });

  it('converte de e para centavos', () => {
    expect(toCents(19.9)).toBe(1990);
    expect(toCents(0.07)).toBe(7);
    expect(fromCents(1990)).toBe(19.9);
  });
});

describe('ean13', () => {
  it('calcula o dígito verificador conhecido', () => {
    // soma ponderada (1,3,1,3...) = 135 -> dígito (10 - 5) % 10 = 5
    expect(ean13CheckDigit('789123456789')).toBe(5);
    expect(isValidEan13('7891234567895')).toBe(true);
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('4006381333932')).toBe(false);
    expect(isValidEan13('123')).toBe(false);
  });

  it('gera códigos sempre válidos', () => {
    for (let i = 0; i < 200; i++)
      expect(isValidEan13(generateEan13())).toBe(true);
  });
});

describe('time (fuso America/Sao_Paulo, UTC-3)', () => {
  const TZ = 'America/Sao_Paulo';

  it('início do dia no fuso: 00:00 local = 03:00 UTC', () => {
    // 21h de 20/10 em São Paulo ainda é dia 20 (já é 21/10 em UTC)
    const instant = new Date('2026-10-21T00:30:00Z');
    expect(startOfDayInTz(instant, TZ).toISOString()).toBe(
      '2026-10-20T03:00:00.000Z',
    );
  });

  it('logo depois da meia-noite local já é o dia seguinte', () => {
    const instant = new Date('2026-10-21T03:10:00Z');
    expect(startOfDayInTz(instant, TZ).toISOString()).toBe(
      '2026-10-21T03:00:00.000Z',
    );
  });

  it('início do mês no fuso', () => {
    expect(
      startOfMonthInTz(new Date('2026-10-15T12:00:00Z'), TZ).toISOString(),
    ).toBe('2026-10-01T03:00:00.000Z');
    // 01/11 00:30 UTC ainda é 31/10 21:30 em São Paulo
    expect(
      startOfMonthInTz(new Date('2026-11-01T00:30:00Z'), TZ).toISOString(),
    ).toBe('2026-10-01T03:00:00.000Z');
  });

  it('formata o dia no fuso', () => {
    expect(formatDayInTz(new Date('2026-10-21T00:30:00Z'), TZ)).toBe(
      '2026-10-20',
    );
  });

  it('soma dias', () => {
    expect(addDays(new Date('2026-10-20T00:00:00Z'), 3).toISOString()).toBe(
      '2026-10-23T00:00:00.000Z',
    );
  });
});
