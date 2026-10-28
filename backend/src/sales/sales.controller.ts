import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  CurrentUser,
  StoreRole,
  Tenant,
} from '../common/decorators/access.decorators';
import type {
  AuthUser,
  StoreTenant,
} from '../common/decorators/access.decorators';
import { CommandTabsService } from './command-tabs.service';
import {
  AddCommandItemDto,
  CloseCommandTabDto,
  CreateCommandTabDto,
  CreateLateSaleDto,
  CreateSaleDto,
  ListCommandTabsQuery,
  ListSalesQuery,
} from './dto/sales.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('stores/:storeId/sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  create(
    @Tenant() tenant: StoreTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSaleDto,
  ) {
    return this.sales.create(
      tenant.storeId,
      tenant.companyId,
      user.id,
      dto,
      tenant.role,
    );
  }

  /** Venda antiga lançada depois (internet caiu etc.): só gerente e dono. */
  @StoreRole(Role.MANAGER)
  @Post('late')
  createLate(
    @Tenant() tenant: StoreTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLateSaleDto,
  ) {
    return this.sales.createLate(
      tenant.storeId,
      tenant.companyId,
      user.id,
      dto,
      tenant.role,
    );
  }

  @Get()
  list(@Tenant() tenant: StoreTenant, @Query() query: ListSalesQuery) {
    return this.sales.list(tenant.storeId, query);
  }

  @Get(':id')
  get(@Tenant() tenant: StoreTenant, @Param('id') id: string) {
    return this.sales.get(tenant.storeId, id);
  }

  @StoreRole(Role.MANAGER)
  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@Tenant() tenant: StoreTenant, @Param('id') id: string) {
    return this.sales.cancel(tenant.storeId, id);
  }
}

@ApiTags('sales')
@ApiBearerAuth()
@Controller('stores/:storeId/command-tabs')
export class CommandTabsController {
  constructor(private readonly tabs: CommandTabsService) {}

  @Post()
  create(@Tenant() tenant: StoreTenant, @Body() dto: CreateCommandTabDto) {
    return this.tabs.create(tenant.storeId, tenant.companyId, dto);
  }

  @Get()
  list(@Tenant() tenant: StoreTenant, @Query() query: ListCommandTabsQuery) {
    return this.tabs.list(tenant.storeId, query.status);
  }

  @Get(':id')
  get(@Tenant() tenant: StoreTenant, @Param('id') id: string) {
    return this.tabs.get(tenant.storeId, id);
  }

  @Post(':id/items')
  addItem(
    @Tenant() tenant: StoreTenant,
    @Param('id') id: string,
    @Body() dto: AddCommandItemDto,
  ) {
    return this.tabs.addItem(tenant.storeId, id, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Tenant() tenant: StoreTenant,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.tabs.removeItem(tenant.storeId, id, itemId);
  }

  @HttpCode(200)
  @Post(':id/close')
  close(
    @Tenant() tenant: StoreTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CloseCommandTabDto,
  ) {
    return this.tabs.close(
      tenant.storeId,
      tenant.companyId,
      user.id,
      id,
      dto,
      tenant.role,
    );
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@Tenant() tenant: StoreTenant, @Param('id') id: string) {
    return this.tabs.cancel(tenant.storeId, id);
  }
}
