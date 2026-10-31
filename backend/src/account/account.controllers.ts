import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AllowWhenReadOnly,
  BillingOwner,
  CompanyAdmin,
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
  ChangePlanDto,
  CreateCompanyDto,
  CreateStoreDto,
  InviteMemberDto,
  SetGeneralManagerDto,
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

  /**
   * Troca de plano pelo responsável. Liberada em somente leitura: escolher o plano faz parte de
   * regularizar a assinatura.
   */
  @BillingOwner()
  @AllowWhenReadOnly()
  @Patch(':organizationId/plan')
  changePlan(@Tenant() tenant: OrgTenant, @Body() dto: ChangePlanDto) {
    return this.organizations.changePlan(tenant.organizationId, dto.planId);
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

  /** Lojas excluídas (antes de `:id`, senão "deleted" seria lido como id). */
  @CompanyOwner()
  @Get('deleted')
  listDeleted(@Tenant() tenant: CompanyTenant) {
    return this.stores.listDeleted(tenant.companyId);
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

  /** Editar a loja: dono ou gerente geral. Criar, excluir e reativar continuam só do dono. */
  @CompanyAdmin()
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

  @CompanyOwner()
  @HttpCode(200)
  @Post(':id/restore')
  restore(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.stores.restore(tenant.companyId, id);
  }
}

/**
 * Equipe: dono ou gerente geral. O gerente geral só mexe em atendentes e gerentes e não dá o papel
 * de dono (o service confere); ver e reativar removidos e marcar gerente geral são só do dono.
 */
@ApiTags('members')
@ApiBearerAuth()
@CompanyAdmin()
@Controller('companies/:companyId/members')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  list(@Tenant() tenant: CompanyTenant) {
    return this.memberships.list(tenant.companyId);
  }

  /** Pessoas removidas da empresa, com as lojas e papéis que tinham. */
  @CompanyOwner()
  @Get('removed')
  listRemoved(@Tenant() tenant: CompanyTenant) {
    return this.memberships.listRemoved(tenant.companyId);
  }

  @CompanyOwner()
  @HttpCode(200)
  @Post(':membershipId/restore')
  restore(
    @Tenant() tenant: CompanyTenant,
    @Param('membershipId') membershipId: string,
  ) {
    return this.memberships.restore(tenant.companyId, membershipId);
  }

  /** Marca ou desmarca o gerente geral (só o dono). */
  @CompanyOwner()
  @Put(':membershipId/general-manager')
  setGeneralManager(
    @Tenant() tenant: CompanyTenant,
    @Param('membershipId') membershipId: string,
    @Body() dto: SetGeneralManagerDto,
  ) {
    return this.memberships.setGeneralManager(
      tenant.companyId,
      tenant.membershipId,
      membershipId,
      dto.isGeneralManager,
    );
  }

  @Post()
  invite(
    @Tenant() tenant: CompanyTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.memberships.invite(tenant, user, dto);
  }

  @Put(':membershipId/stores/:targetStoreId')
  setRole(
    @Tenant() tenant: CompanyTenant,
    @Param('membershipId') membershipId: string,
    @Param('targetStoreId') targetStoreId: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.memberships.setRole(
      tenant,
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
      tenant,
      membershipId,
      targetStoreId,
    );
  }

  @Delete(':membershipId')
  remove(
    @Tenant() tenant: CompanyTenant,
    @Param('membershipId') membershipId: string,
  ) {
    return this.memberships.remove(tenant, membershipId);
  }
}
