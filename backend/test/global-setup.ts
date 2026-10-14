import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { adminDatabaseUrl, TEST_DB_NAME, testDatabaseUrl } from './test-db';

/** Cria o banco de teste (se não existir) e aplica as migrations nele. */
export default async function globalSetup() {
  const admin = new Client({ connectionString: adminDatabaseUrl() });
  await admin.connect();
  try {
    const exists = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );
    if (exists.rowCount === 0)
      await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await admin.end();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  });
}
