import { Module } from '@nestjs/common';
import {
  CompaniesController,
  MembershipsController,
  OrganizationsController,
  StoresController,
} from './account.controllers';
import { CompaniesService } from './companies.service';
import { MembershipsService } from './memberships.service';
import { OrganizationsService } from './organizations.service';
import { StoresService } from './stores.service';

@Module({
  controllers: [
    OrganizationsController,
    CompaniesController,
    StoresController,
    MembershipsController,
  ],
  providers: [
    OrganizationsService,
    CompaniesService,
    StoresService,
    MembershipsService,
  ],
  exports: [StoresService],
})
export class AccountModule {}
