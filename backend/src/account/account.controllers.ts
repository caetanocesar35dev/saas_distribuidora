import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  BillingOwner,
  CompanyOwner,
  CurrentUser,
  Tenant,
} from '../common/decorators/access.decorators';
import type {
  AuthUser,
  CompanyTenant,
  OrgTenant,
} from '../common/decorators/access.decorators';
import { CompaniesService } from './companies.service';
import {
  CreateCompanyDto,
  CreateStoreDto,
  InviteMemberDto,
  SetRoleDto,
  UpdateCompanyDto,
  UpdateStoreDto,
} from './dto/account.dto';
import { MembershipsService } from './memberships.service';
import { OrganizationsService } from './organizations.service';
import { StoresService } from './stores.service';

// Atenção: em rotas de company, ids de recursos aninhados NÃO podem se chamar storeId/companyId
// (esses nomes são reservados ao TenantGuard). Por isso `:id` e `:targetStoreId`.

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.organizations.mine(user.id);
  }

  @BillingOwner()
  @Post(':organizationId/companies')
  createCompany(
    @Tenant() tenant: OrgTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.organizations.createCompany(
      tenant.organizationId,
      user.id,
      dto,
    );
  }
}

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies/:companyId')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  get(@Tenant() tenant: CompanyTenant) {
    return this.companies.get(tenant.companyId);
  }

  @CompanyOwner()
  @Patch()
  update(@Tenant() tenant: CompanyTenant, @Body() dto: UpdateCompanyDto) {
    return this.companies.update(tenant.companyId, dto);
  }
}

@ApiTags('stores')
@ApiBearerAuth()
@Controller('companies/:companyId/stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  list(@Tenant() tenant: CompanyTenant) {
    return this.stores.list(tenant.companyId);
  }

  @Get(':id')
  get(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.stores.get(tenant.companyId, id);
  }

  @CompanyOwner()
  @Post()
  create(@Tenant() tenant: CompanyTenant, @Body() dto: CreateStoreDto) {
    return this.stores.create(tenant.companyId, dto);
  }

  @CompanyOwner()
  @Patch(':id')
  update(
    @Tenant() tenant: CompanyTenant,
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.stores.update(tenant.companyId, id, dto);
  }

  @CompanyOwner()
  @Delete(':id')
  remove(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.stores.remove(tenant.companyId, id);
  }
}

@ApiTags('members')
@ApiBearerAuth()
@CompanyOwner()
@Controller('companies/:companyId/members')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  list(@Tenant() tenant: CompanyTenant) {
    return this.memberships.list(tenant.companyId);
  }

  @Post()
  invite(
    @Tenant() tenant: CompanyTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.memberships.invite(tenant.companyId, user, dto);
  }

  @Put(':membershipId/stores/:targetStoreId')
  setRole(
    @Tenant() tenant: CompanyTenant,
    @Param('membershipId') membershipId: string,
    @Param('targetStoreId') targetStoreId: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.memberships.setRole(
      tenant.companyId,
      tenant.membershipId,
      membershipId,
      targetStoreId,
      dto.role,
    );
  }

  @Delete(':membershipId/stores/:targetStoreId')
  removeFromStore(
    @Tenant() tenant: CompanyTenant,
    @Param('membershipId') membershipId: string,
    @Param('targetStoreId') targetStoreId: string,
  ) {
    return this.memberships.removeFromStore(
      tenant.companyId,
      membershipId,
      targetStoreId,
    );
  }

  @Delete(':membershipId')
  remove(
    @Tenant() tenant: CompanyTenant,
    @Param('membershipId') membershipId: string,
  ) {
    return this.memberships.remove(tenant.companyId, membershipId);
  }
}
