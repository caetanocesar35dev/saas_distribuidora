export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  REFRESH_TOKEN_DAYS: number;
  CORS_ORIGINS: string[];
  APP_URL: string;
  APP_TIMEZONE: string;
  TRIAL_DAYS: number;
  SUBSCRIPTION_GRACE_DAYS: number;
  LOW_STOCK_THRESHOLD: number;
  BCRYPT_ROUNDS: number;
  EMAIL_HOST: string;
  EMAIL_PORT: number;
  EMAIL_USER?: string;
  EMAIL_PASS?: string;
  EMAIL_FROM?: string;
}

function toInt(raw: unknown, name: string, fallback: number, min = 0): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(
      `Variável de ambiente ${name} inválida: "${typeof raw === 'string' ? raw : JSON.stringify(raw)}"`,
    );
  }
  return value;
}

/**
 * Valida o ambiente na subida: sem DATABASE_URL ou JWT_SECRET a aplicação não inicia.
 * O JWT_SECRET é definido pelo usuário no .env (sem regra de tamanho).
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const nodeEnv = (raw.NODE_ENV as Env['NODE_ENV']) || 'development';
  const isProd = nodeEnv === 'production';
  const missing: string[] = [];

  const need = (name: string): string => {
    const value = raw[name];
    if (typeof value !== 'string' || value.trim() === '') missing.push(name);
    return typeof value === 'string' ? value : '';
  };

  const DATABASE_URL = need('DATABASE_URL');
  const JWT_SECRET = need('JWT_SECRET');

  // Em produção, CORS_ORIGINS e APP_URL são obrigatórios. Em dev/teste, o padrão é o Vite local.
  const corsRaw = raw.CORS_ORIGINS as string | undefined;
  const appUrlRaw = raw.APP_URL as string | undefined;
  if (isProd && !corsRaw) missing.push('CORS_ORIGINS');
  if (isProd && !appUrlRaw) missing.push('APP_URL');

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}. ` +
        'Veja backend/.env.example.',
    );
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: toInt(raw.PORT, 'PORT', 3001, 1),
    DATABASE_URL,
    JWT_SECRET,
    JWT_ACCESS_EXPIRES_IN: (raw.JWT_ACCESS_EXPIRES_IN as string) || '15m',
    REFRESH_TOKEN_DAYS: toInt(
      raw.REFRESH_TOKEN_DAYS,
      'REFRESH_TOKEN_DAYS',
      30,
      1,
    ),
    CORS_ORIGINS: (corsRaw || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    APP_URL: (appUrlRaw || 'http://localhost:5173').replace(/\/$/, ''),
    APP_TIMEZONE: (raw.APP_TIMEZONE as string) || 'America/Sao_Paulo',
    TRIAL_DAYS: toInt(raw.TRIAL_DAYS, 'TRIAL_DAYS', 14, 1),
    SUBSCRIPTION_GRACE_DAYS: toInt(
      raw.SUBSCRIPTION_GRACE_DAYS,
      'SUBSCRIPTION_GRACE_DAYS',
      5,
      0,
    ),
    LOW_STOCK_THRESHOLD: toInt(
      raw.LOW_STOCK_THRESHOLD,
      'LOW_STOCK_THRESHOLD',
      20,
      0,
    ),
    BCRYPT_ROUNDS: toInt(raw.BCRYPT_ROUNDS, 'BCRYPT_ROUNDS', 12, 4),
    EMAIL_HOST: (raw.EMAIL_HOST as string) || 'smtp.gmail.com',
    EMAIL_PORT: toInt(raw.EMAIL_PORT, 'EMAIL_PORT', 465, 1),
    EMAIL_USER: (raw.EMAIL_USER as string) || undefined,
    EMAIL_PASS: (raw.EMAIL_PASS as string) || undefined,
    EMAIL_FROM: (raw.EMAIL_FROM as string) || undefined,
  };
}
