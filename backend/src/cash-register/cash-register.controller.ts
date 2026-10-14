import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  AllowWhenReadOnly,
  hasMinRole,
  Tenant,
} from '../common/decorators/access.decorators';
import type { StoreTenant } from '../common/decorators/access.decorators';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CashRegisterService } from './cash-register.service';
import { CashMovementDto, OpenCashRegisterDto } from './dto/cash-register.dto';

@ApiTags('cash-register')
@ApiBearerAuth()
@Controller('stores/:storeId/cash-register')
export class CashRegisterController {
  constructor(private readonly cash: CashRegisterService) {}

  @Post('open')
  open(@Tenant() tenant: StoreTenant, @Body() dto: OpenCashRegisterDto) {
    return this.cash.open(tenant.storeId, dto.initialBalance);
  }

  @Get('current')
  current(@Tenant() tenant: StoreTenant) {
    return this.cash.current(tenant.storeId);
  }

  /** Fechar o caixa já aberto continua liberado mesmo com a assinatura em somente leitura. */
  @AllowWhenReadOnly()
  @HttpCode(200)
  @Post('close')
  close(@Tenant() tenant: StoreTenant) {
    return this.cash.close(tenant.storeId);
  }

  /** Entrada: funcionário. Saída (sangria): gerente. */
  @Post('movements')
  addMovement(@Tenant() tenant: StoreTenant, @Body() dto: CashMovementDto) {
    if (dto.type === 'OUT' && !hasMinRole(tenant.role, Role.MANAGER)) {
      throw new ForbiddenException('Saídas de caixa exigem papel de gerente.');
    }
    return this.cash.addMovement(tenant.storeId, dto);
  }

  @Get('history')
  history(@Tenant() tenant: StoreTenant, @Query() query: PaginationQueryDto) {
    return this.cash.history(tenant.storeId, query);
  }

  @Get(':id')
  get(@Tenant() tenant: StoreTenant, @Param('id') id: string) {
    return this.cash.get(tenant.storeId, id);
  }
}
