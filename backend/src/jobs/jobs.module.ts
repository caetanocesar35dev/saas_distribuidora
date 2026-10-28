import { Module } from '@nestjs/common';
import { CashRegisterModule } from '../cash-register/cash-register.module';
import { CashAutoCloseJob } from './cash-auto-close.job';
import { RefreshTokenCleanupJob } from './refresh-token-cleanup.job';
import { SubscriptionRemindersJob } from './subscription-reminders.job';

@Module({
  imports: [CashRegisterModule],
  providers: [
    SubscriptionRemindersJob,
    RefreshTokenCleanupJob,
    CashAutoCloseJob,
  ],
})
export class JobsModule {}
