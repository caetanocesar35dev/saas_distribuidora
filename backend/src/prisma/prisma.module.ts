import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditContext } from '../audit/audit-context';
import { Env } from '../config/env';
import { createPrismaClient } from './prisma.extension';
import { PrismaService } from './prisma.service';

/** Guarda as conexões para encerrá-las no shutdown. */
class PrismaConnection implements OnModuleDestroy {
  constructor(
    private readonly connection: ReturnType<typeof createPrismaClient>,
  ) {}

  get client() {
    return this.connection.client;
  }

  async onModuleDestroy() {
    await this.connection.base.$disconnect();
    await this.connection.pool.end();
  }
}

@Global()
@Module({
  providers: [
    AuditContext,
    {
      provide: PrismaConnection,
      inject: [ConfigService, AuditContext],
      useFactory: (config: ConfigService<Env, true>, audit: AuditContext) =>
        new PrismaConnection(
          createPrismaClient(
            config.get('DATABASE_URL', { infer: true }),
            audit,
          ),
        ),
    },
    {
      provide: PrismaService,
      inject: [PrismaConnection],
      useFactory: (connection: PrismaConnection) => connection.client,
    },
  ],
  exports: [PrismaService, AuditContext],
})
export class PrismaModule {}
