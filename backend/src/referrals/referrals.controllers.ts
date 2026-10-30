import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  BillingOwner,
  RequirePlatformRole,
  Tenant,
} from '../common/decorators/access.decorators';
import type { OrgTenant } from '../common/decorators/access.decorators';
import {
  CancelReferralDto,
  CommissionPaidDto,
  CreateRepresentativeDto,
  ListReferralsQuery,
  ListRepresentativesQuery,
  UpdateRepresentativeDto,
} from './referrals.dto';
import { ReferralsService } from './referrals.service';

/** "Indique e ganhe": só o responsável pela assinatura (é quem recebe o desconto). */
@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations/:organizationId/referral')
export class OrganizationReferralController {
  constructor(private readonly referrals: ReferralsService) {}

  @BillingOwner()
  @Get()
  get(@Tenant() tenant: OrgTenant) {
    return this.referrals.forOrganization(tenant.organizationId);
  }
}

// Rotas da plataforma: SUPPORT só lê; SUPERADMIN lê e escreve.

@ApiTags('platform')
@ApiBearerAuth()
@RequirePlatformRole('SUPPORT', 'SUPERADMIN')
@Controller('platform/representatives')
export class PlatformRepresentativesController {
  constructor(private readonly referrals: ReferralsService) {}

  /** `?deleted=true` lista os excluídos. */
  @Get()
  list(@Query() query: ListRepresentativesQuery) {
    return this.referrals.listRepresentatives(query.deleted ?? false);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Post()
  create(@Body() dto: CreateRepresentativeDto) {
    return this.referrals.createRepresentative(dto);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRepresentativeDto) {
    return this.referrals.updateRepresentative(id, dto);
  }

  @RequirePlatformRole('SUPERADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.referrals.removeRepresentative(id);
  }

  @RequirePlatformRole('SUPERADMIN')
  @HttpCode(200)
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.referrals.restoreRepresentative(id);
  }
}

@ApiTags('platform')
@ApiBearerAuth()
@RequirePlatformRole('SUPPORT', 'SUPERADMIN')
@Controller('platform/referrals')
export class PlatformReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  list(@Query() query: ListReferralsQuery) {
    return this.referrals.listReferrals(query);
  }

  /** Painel (antes de `:id`). */
  @Get('summary')
  summary() {
    return this.referrals.summary();
  }

  @RequirePlatformRole('SUPERADMIN')
  @HttpCode(200)
  @Post(':id/commission-paid')
  commissionPaid(@Param('id') id: string, @Body() dto: CommissionPaidDto) {
    return this.referrals.markCommissionPaid(id, dto.note);
  }

  @RequirePlatformRole('SUPERADMIN')
  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelReferralDto) {
    return this.referrals.cancelReferral(id, dto.reason);
  }
}
