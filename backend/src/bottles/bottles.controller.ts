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
import { hasMinRole, Tenant } from '../common/decorators/access.decorators';
import type { StoreTenant } from '../common/decorators/access.decorators';
import { BottleMovementsService } from './bottle-movements.service';
import {
  CustomerBottleDto,
  ListBottleMovementsQuery,
  ManualBottleMovementDto,
} from './dto/bottles.dto';

@ApiTags('bottles')
@ApiBearerAuth()
@Controller('stores/:storeId')
export class BottlesController {
  constructor(private readonly movements: BottleMovementsService) {}

  @Get('bottle-movements')
  list(
    @Tenant() tenant: StoreTenant,
    @Query() query: ListBottleMovementsQuery,
  ) {
    return this.movements.list(tenant.storeId, query);
  }

  /** Envio/recebimento de fornecedor: EMPLOYEE. Ajuste manual: MANAGER. */
  @Post('bottle-movements')
  registerManual(
    @Tenant() tenant: StoreTenant,
    @Body() dto: ManualBottleMovementDto,
  ) {
    if (
      dto.type === 'MANUAL_ADJUSTMENT' &&
      !hasMinRole(tenant.role, Role.MANAGER)
    ) {
      throw new ForbiddenException(
        'O ajuste manual de vasilhames exige papel de gerente.',
      );
    }
    return this.movements.registerManual(tenant.storeId, tenant.companyId, dto);
  }

  @Get('bottle-stock')
  stock(@Tenant() tenant: StoreTenant) {
    return this.movements.stock(tenant.storeId, tenant.companyId);
  }

  /** Devolução: só abate a dívida da própria loja. */
  @HttpCode(201)
  @Post('customers/:customerId/bottle-returns')
  customerReturn(
    @Tenant() tenant: StoreTenant,
    @Param('customerId') customerId: string,
    @Body() dto: CustomerBottleDto,
  ) {
    return this.movements.customerReturn(
      tenant.storeId,
      tenant.companyId,
      customerId,
      dto,
    );
  }

  @Post('customers/:customerId/bottle-loans')
  customerBorrow(
    @Tenant() tenant: StoreTenant,
    @Param('customerId') customerId: string,
    @Body() dto: CustomerBottleDto,
  ) {
    return this.movements.customerBorrow(
      tenant.storeId,
      tenant.companyId,
      customerId,
      dto,
    );
  }
}
