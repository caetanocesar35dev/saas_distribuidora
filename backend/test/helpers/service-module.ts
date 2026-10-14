import { ModuleMetadata, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditContext } from '../../src/audit/audit-context';
import { validateEnv } from '../../src/config/env';
import { MailService } from '../../src/mail/mail.service';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Factory } from './factory';
import { FakeMailService } from './fake-mail';
import { truncateAll } from './prisma-test';

export interface ServiceTestContext {
  module: TestingModule;
  prisma: PrismaService;
  audit: AuditContext;
  mail: FakeMailService;
  factory: Factory;
  /** Executa fn como uma requisição HTTP: com autor (opcional) e a rota informada. */
  asRequest: <T>(
    fn: () => Promise<T>,
    opts?: { userId?: string | null; endpoint?: string },
  ) => Promise<T>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Módulo Nest para testar services com o Prisma REAL no banco de teste (extensão de auditoria,
 * triggers e constraints incluídos). Só o e-mail é substituído.
 */
export async function createServiceTest(
  providers: Provider[],
  extra: Pick<ModuleMetadata, 'imports'> = {},
): Promise<ServiceTestContext> {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: validateEnv,
      }),
      JwtModule.register({
        global: true,
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '15m' },
      }),
      PrismaModule,
      ...(extra.imports ?? []),
    ],
    providers: [
      ...providers,
      { provide: MailService, useClass: FakeMailService },
    ],
  }).compile();

  const prisma = module.get(PrismaService);
  const audit = module.get(AuditContext);
  const mail = module.get<MailService, FakeMailService>(MailService);

  return {
    module,
    prisma,
    audit,
    mail,
    factory: new Factory(prisma, audit),
    asRequest: (fn, opts = {}) =>
      audit.run(
        {
          userId: opts.userId ?? null,
          endpoint: opts.endpoint ?? 'POST /api/teste',
          withDeleted: false,
        },
        fn,
      ),
    reset: async () => {
      mail.reset();
      await truncateAll(prisma);
    },
    close: async () => {
      await module.close();
    },
  };
}
