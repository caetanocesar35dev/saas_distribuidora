import { testDatabaseUrl, TEST_DB_NAME } from './test-db';

// Executa em cada arquivo de teste, antes de qualquer import da aplicação.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4'; // senhas rápidas nos testes
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';
// Sem credenciais de e-mail os testes nunca enviam mensagem real.
delete process.env.EMAIL_USER;
delete process.env.EMAIL_PASS;

if (!new URL(process.env.DATABASE_URL).pathname.endsWith(TEST_DB_NAME)) {
  throw new Error('Os testes só podem rodar no banco de teste.');
}
