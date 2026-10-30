import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import {
  CompanyAdmin,
  StoreRole,
  Tenant,
} from '../common/decorators/access.decorators';
import type {
  CompanyTenant,
  StoreTenant,
} from '../common/decorators/access.decorators';
import { AuditLogService } from './audit-log.service';

export class AuditQuery {
  /** Instante (ISO 8601): devolve só a versão que valia naquele momento. */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'at deve ser uma data/hora válida (ISO 8601).' })
  at?: Date;
}

/**
 * Histórico de alterações dos registros (quem mudou, quando, por qual rota e o que mudou).
 * Só leitura: o histórico é gravado pelo trigger do banco.
 */
@ApiTags('audit')
@ApiBearerAuth()
@Controller()
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @StoreRole(Role.MANAGER)
  @Get('stores/:storeId/audit/:entity/:id')
  forStore(
    @Tenant() tenant: StoreTenant,
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Query() query: AuditQuery,
  ) {
    return query.at
      ? this.auditLog.at('store', tenant.storeId, entity, id, query.at)
      : this.auditLog.history('store', tenant.storeId, entity, id);
  }

  @CompanyAdmin()
  @Get('companies/:companyId/audit/:entity/:id')
  forCompany(
    @Tenant() tenant: CompanyTenant,
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Query() query: AuditQuery,
  ) {
    return query.at
      ? this.auditLog.at('company', tenant.companyId, entity, id, query.at)
      : this.auditLog.history('company', tenant.companyId, entity, id);
  }
}
