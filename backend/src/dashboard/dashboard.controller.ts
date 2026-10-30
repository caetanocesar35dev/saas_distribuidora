import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  CompanyAdmin,
  StoreRole,
  Tenant,
} from '../common/decorators/access.decorators';
import type {
  CompanyTenant,
  StoreTenant,
} from '../common/decorators/access.decorators';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @StoreRole(Role.MANAGER)
  @Get('stores/:storeId/dashboard')
  store(@Tenant() tenant: StoreTenant) {
    return this.dashboard.forStore(tenant.storeId);
  }

  /** "Primeiros passos" do Início: o que o dono já fez na loja (decisão do usuário). */
  @StoreRole(Role.OWNER)
  @Get('stores/:storeId/onboarding')
  onboarding(@Tenant() tenant: StoreTenant) {
    return this.dashboard.onboarding(tenant.storeId, tenant.companyId);
  }

  @CompanyAdmin()
  @Get('companies/:companyId/dashboard')
  company(@Tenant() tenant: CompanyTenant) {
    return this.dashboard.forCompany(tenant.companyId);
  }
}
