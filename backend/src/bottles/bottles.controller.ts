import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  CompanyRole,
  hasMinRole,
  StoreRole,
  Tenant,
} from '../common/decorators/access.decorators';
import type {
  CompanyTenant,
  StoreTenant,
} from '../common/decorators/access.decorators';
import { BottleMovementsService } from './bottle-movements.service';
import {
  CreateSupplierDto,
  CustomerBottleDto,
  ListBottleMovementsQuery,
  ListSuppliersQuery,
  ManualBottleMovementDto,
  SetStoreBottlePriceDto,
  UpdateSupplierDto,
} from './dto/bottles.dto';
import { SuppliersService } from './suppliers.service';

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

  /** Saldo de cascos com cada fornecedor nesta loja (recebidos − enviados). */
  @Get('supplier-bottle-balances')
  supplierBalances(@Tenant() tenant: StoreTenant) {
    return this.movements.supplierBalances(tenant.storeId);
  }

  /** Preço próprio do casco nesta loja (`null` = vale o da empresa): gerente ou dono. */
  @StoreRole(Role.MANAGER)
  @Put('bottle-types/:id/price')
  setStorePrice(
    @Tenant() tenant: StoreTenant,
    @Param('id') id: string,
    @Body() dto: SetStoreBottlePriceDto,
  ) {
    return this.movements.setStorePrice(
      tenant.storeId,
      tenant.companyId,
      id,
      dto.price,
    );
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

/** Fornecedores da empresa. Todos listam (o atendente escolhe no envio); gerente e dono editam. */
@ApiTags('bottles')
@ApiBearerAuth()
@Controller('companies/:companyId/suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(@Tenant() tenant: CompanyTenant, @Query() query: ListSuppliersQuery) {
    return this.suppliers.list(tenant.companyId, query);
  }

  @CompanyRole(Role.MANAGER)
  @Post()
  create(@Tenant() tenant: CompanyTenant, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(tenant.companyId, dto);
  }

  @CompanyRole(Role.MANAGER)
  @Patch(':id')
  update(
    @Tenant() tenant: CompanyTenant,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(tenant.companyId, id, dto);
  }

  @CompanyRole(Role.MANAGER)
  @Delete(':id')
  remove(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.suppliers.remove(tenant.companyId, id);
  }

  @CompanyRole(Role.MANAGER)
  @HttpCode(200)
  @Post(':id/restore')
  restore(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.suppliers.restore(tenant.companyId, id);
  }
}
