import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditContextInterceptor } from './audit/audit-context.interceptor';
import { HideCostInterceptor } from './common/interceptors/hide-cost.interceptor';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { AuthGuard } from './common/guards/auth.guard';
import { PlatformGuard } from './common/guards/platform.guard';
import { SubscriptionGuard } from './common/guards/subscription.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { validateEnv } from './config/env';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';
import { MailModule } from './mail/mail.module';
import { AccountModule } from './account/account.module';
import { BottlesModule } from './bottles/bottles.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SalesModule } from './sales/sales.module';
import { MeModule } from './me/me.module';
import { PlansController } from './plans/plans.controller';
import { PlatformModule } from './platform/platform.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReferralsModule } from './referrals/referrals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    // Rate limiting em memória. 'default' é por minuto; 'hourly' só limita onde for declarado.
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 300 },
        { name: 'hourly', ttl: 3_600_000, limit: 100_000 },
      ],
      skipIf: () =>
        process.env.NODE_ENV === 'test' && !process.env.RATE_LIMIT_IN_TEST,
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    MeModule,
    AccountModule,
    CatalogModule,
    BottlesModule,
    CustomersModule,
    CashRegisterModule,
    SalesModule,
    DashboardModule,
    AuditLogModule,
    PlatformModule,
    ReferralsModule,
    JobsModule,
  ],
  controllers: [HealthController, PlansController],
  providers: [
    // A ordem importa: autentica -> plataforma -> tenant (acesso) -> assinatura -> rate limit.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PlatformGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
    // Atendente nunca recebe custo nem lucro em nenhuma resposta.
    { provide: APP_INTERCEPTOR, useClass: HideCostInterceptor },
  ],
})
export class AppModule {}
