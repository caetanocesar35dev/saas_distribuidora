import { validateEnv } from './env';

const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'segredo' };

describe('validateEnv', () => {
  it('só exige DATABASE_URL e JWT_SECRET em desenvolvimento, e aplica os padrões', () => {
    const env = validateEnv(base);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      JWT_ACCESS_EXPIRES_IN: '15m',
      REFRESH_TOKEN_DAYS: 30,
      TRIAL_DAYS: 14,
      SUBSCRIPTION_GRACE_DAYS: 5,
      LOW_STOCK_THRESHOLD: 20,
      BCRYPT_ROUNDS: 12,
      APP_TIMEZONE: 'America/Sao_Paulo',
      CORS_ORIGINS: ['http://localhost:5173'],
      APP_URL: 'http://localhost:5173',
      EMAIL_HOST: 'smtp.gmail.com',
      EMAIL_PORT: 465,
    });
    expect(env.EMAIL_USER).toBeUndefined();
  });

  it('sem JWT_SECRET ou DATABASE_URL a aplicação não sobe, e a mensagem diz o que falta', () => {
    expect(() => validateEnv({ DATABASE_URL: 'x' })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ JWT_SECRET: 'x' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({})).toThrow(/DATABASE_URL, JWT_SECRET/);
    expect(() => validateEnv({ ...base, JWT_SECRET: '   ' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('o JWT_SECRET não tem regra de tamanho (o usuário define)', () => {
    expect(validateEnv({ ...base, JWT_SECRET: 'a' }).JWT_SECRET).toBe('a');
  });

  it('em produção CORS_ORIGINS e APP_URL são obrigatórios', () => {
    const prod = { ...base, NODE_ENV: 'production' };
    expect(() => validateEnv(prod)).toThrow(/CORS_ORIGINS, APP_URL/);
    expect(() =>
      validateEnv({ ...prod, CORS_ORIGINS: 'https://app.com' }),
    ).toThrow(/APP_URL/);
    const ok = validateEnv({
      ...prod,
      CORS_ORIGINS: 'https://a.com, https://b.com',
      APP_URL: 'https://app.com/',
    });
    expect(ok.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
    expect(ok.APP_URL).toBe('https://app.com'); // sem barra final
  });

  it('converte números e rejeita valores inválidos', () => {
    expect(
      validateEnv({
        ...base,
        PORT: '4000',
        TRIAL_DAYS: '30',
        SUBSCRIPTION_GRACE_DAYS: '0',
      }),
    ).toMatchObject({
      PORT: 4000,
      TRIAL_DAYS: 30,
      SUBSCRIPTION_GRACE_DAYS: 0,
    });
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...base, TRIAL_DAYS: '0' })).toThrow(
      /TRIAL_DAYS/,
    );
    expect(() => validateEnv({ ...base, BCRYPT_ROUNDS: '2' })).toThrow(
      /BCRYPT_ROUNDS/,
    );
    expect(() => validateEnv({ ...base, REFRESH_TOKEN_DAYS: '1.5' })).toThrow(
      /REFRESH_TOKEN_DAYS/,
    );
  });

  it('vazio conta como ausente (usa o padrão)', () => {
    expect(validateEnv({ ...base, PORT: '', EMAIL_USER: '' }).PORT).toBe(3001);
    expect(validateEnv({ ...base, EMAIL_USER: '' }).EMAIL_USER).toBeUndefined();
  });
});
