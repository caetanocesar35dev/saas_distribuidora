import { Module } from '@nestjs/common';
import { RefreshTokenCleanupJob } from './refresh-token-cleanup.job';
import { SubscriptionRemindersJob } from './subscription-reminders.job';

@Module({ providers: [SubscriptionRemindersJob, RefreshTokenCleanupJob] })
export class JobsModule {}
