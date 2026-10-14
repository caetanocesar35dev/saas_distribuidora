import { AuditContext } from '../../src/audit/audit-context';
import {
  createPrismaClient,
  ExtendedPrismaClient,
} from '../../src/prisma/prisma.extension';

export interface TestPrisma {
  audit: AuditContext;
  prisma: ExtendedPrismaClient;
  close: () => Promise<void>;
}

/** Cliente Prisma (com a extensão de auditoria) apontando para o banco de teste. */
export function createTestPrisma(): TestPrisma {
  const audit = new AuditContext();
  const { client, base, pool } = createPrismaClient(
    process.env.DATABASE_URL!,
    audit,
  );
  return {
    audit,
    prisma: client,
    close: async () => {
      await base.$disconnect();
      await pool.end();
    },
  };
}

/**
 * Esvazia todas as tabelas (negócio e histórico). TRUNCATE não dispara o trigger que bloqueia
 * DELETE, por isso é a forma correta de limpar dados nos testes.
 */
export async function truncateAll(prisma: ExtendedPrismaClient) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename ~ '^t[bh]_'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
