import * as dotenv from 'dotenv';

export const TEST_DB_NAME = 'distribuidora_test';

/**
 * URL do banco de TESTE: o mesmo servidor do DATABASE_URL do .env, com outro nome de banco.
 * Os testes truncam todas as tabelas; por isso nunca podem apontar para o banco de desenvolvimento.
 */
export function testDatabaseUrl(): string {
  dotenv.config({ quiet: true });
  const raw = process.env.DATABASE_URL;
  if (!raw)
    throw new Error(
      'DATABASE_URL ausente: os testes precisam do servidor Postgres do .env.',
    );
  const url = new URL(raw);
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

export function adminDatabaseUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.pathname = '/postgres';
  return url.toString();
}
