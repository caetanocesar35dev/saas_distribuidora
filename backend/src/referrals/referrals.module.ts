import { Module } from '@nestjs/common';
import {
  OrganizationReferralController,
  PlatformReferralsController,
  PlatformRepresentativesController,
} from './referrals.controllers';
import { ReferralsService } from './referrals.service';

@Module({
  controllers: [
    OrganizationReferralController,
    PlatformRepresentativesController,
    PlatformReferralsController,
  ],
  providers: [ReferralsService],
})
export class ReferralsModule {}
