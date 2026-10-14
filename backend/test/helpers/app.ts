import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuditContext } from '../../src/audit/audit-context';
import { configureApp } from '../../src/app.setup';
import { MailService } from '../../src/mail/mail.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DEFAULT_PASSWORD, Factory } from './factory';
import { FakeMailService } from './fake-mail';
import { truncateAll } from './prisma-test';

export interface TestApp {
  app: INestApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
  audit: AuditContext;
  mail: FakeMailService;
  factory: Factory;
  reset: () => Promise<void>;
  /** Faz login via HTTP e devolve o header Authorization pronto. */
  login: (
    email: string,
    password?: string,
  ) => Promise<{ Authorization: string; refresh: string; userId: string }>;
  close: () => Promise<void>;
}

/** Sobe a aplicação inteira (guards, interceptor, filtros e pipes reais) com o e-mail falso. */
export async function createTestApp(
  options: { swagger?: boolean } = {},
): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useClass(FakeMailService)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app, { swagger: options.swagger ?? false });
  await app.init();

  const prisma = app.get(PrismaService);
  const audit = app.get(AuditContext);
  const mail = app.get<MailService, FakeMailService>(MailService);
  const http = request(app.getHttpServer());

  return {
    app,
    http,
    prisma,
    audit,
    mail,
    factory: new Factory(prisma, audit),
    reset: async () => {
      mail.reset();
      await truncateAll(prisma);
    },
    login: async (email, password = DEFAULT_PASSWORD) => {
      const res = await http
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      return {
        Authorization: `Bearer ${res.body.access_token}`,
        refresh: res.body.refresh_token,
        userId: res.body.user.id,
      };
    },
    close: () => app.close(),
  };
}
