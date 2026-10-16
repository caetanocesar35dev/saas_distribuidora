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
import { Role } from '@prisma/client';
import {
  CompanyRole,
  StoreRole,
  Tenant,
} from '../common/decorators/access.decorators';
import type {
  CompanyTenant,
  StoreTenant,
} from '../common/decorators/access.decorators';
import { BottleTypesService } from './bottle-types.service';
import {
  AddStoreProductDto,
  CreateBottleTypeDto,
  CreateProductDto,
  ListProductsQuery,
  ListStoreProductsQuery,
  LowStockQuery,
  StockAdjustmentDto,
  StockEntryDto,
  UpdateBottleTypeDto,
  UpdateProductDto,
  UpdateStoreProductDto,
} from './dto/catalog.dto';
import { ProductsService } from './products.service';
import { StoreProductsService } from './store-products.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('companies/:companyId/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Tenant() tenant: CompanyTenant, @Query() query: ListProductsQuery) {
    return this.products.list(tenant.companyId, query);
  }

  @Get(':id')
  get(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.products.get(tenant.companyId, id);
  }

  @CompanyRole(Role.MANAGER)
  @Post()
  create(@Tenant() tenant: CompanyTenant, @Body() dto: CreateProductDto) {
    return this.products.create(tenant.companyId, dto);
  }

  @CompanyRole(Role.MANAGER)
  @Patch(':id')
  update(
    @Tenant() tenant: CompanyTenant,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(tenant.companyId, id, dto);
  }

  @CompanyRole(Role.MANAGER)
  @Delete(':id')
  remove(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.products.remove(tenant.companyId, id);
  }

  @CompanyRole(Role.MANAGER)
  @HttpCode(200)
  @Post(':id/restore')
  restore(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.products.restore(tenant.companyId, id);
  }
}

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('companies/:companyId/bottle-types')
export class BottleTypesController {
  constructor(private readonly bottleTypes: BottleTypesService) {}

  @Get()
  list(@Tenant() tenant: CompanyTenant) {
    return this.bottleTypes.list(tenant.companyId);
  }

  @CompanyRole(Role.MANAGER)
  @Post()
  create(@Tenant() tenant: CompanyTenant, @Body() dto: CreateBottleTypeDto) {
    return this.bottleTypes.create(tenant.companyId, dto);
  }

  @CompanyRole(Role.MANAGER)
  @Patch(':id')
  update(
    @Tenant() tenant: CompanyTenant,
    @Param('id') id: string,
    @Body() dto: UpdateBottleTypeDto,
  ) {
    return this.bottleTypes.update(tenant.companyId, id, dto);
  }

  @CompanyRole(Role.MANAGER)
  @Delete(':id')
  remove(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.bottleTypes.remove(tenant.companyId, id);
  }

  @CompanyRole(Role.MANAGER)
  @HttpCode(200)
  @Post(':id/restore')
  restore(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.bottleTypes.restore(tenant.companyId, id);
  }
}

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('stores/:storeId/store-products')
export class StoreProductsController {
  constructor(private readonly storeProducts: StoreProductsService) {}

  @Get()
  list(@Tenant() tenant: StoreTenant, @Query() query: ListStoreProductsQuery) {
    return this.storeProducts.list(tenant.storeId, query);
  }

  @StoreRole(Role.MANAGER)
  @Get('low-stock')
  lowStock(@Tenant() tenant: StoreTenant, @Query() query: LowStockQuery) {
    return this.storeProducts.lowStock(tenant.storeId, query.threshold);
  }

  @Get('by-code/:code')
  byCode(@Tenant() tenant: StoreTenant, @Param('code') code: string) {
    return this.storeProducts.getByCode(tenant.storeId, code);
  }

  @Get(':id')
  get(@Tenant() tenant: StoreTenant, @Param('id') id: string) {
    return this.storeProducts.get(tenant.storeId, id);
  }

  @StoreRole(Role.MANAGER)
  @Post()
  add(@Tenant() tenant: StoreTenant, @Body() dto: AddStoreProductDto) {
    return this.storeProducts.add(tenant.storeId, tenant.companyId, dto);
  }

  @StoreRole(Role.MANAGER)
  @Patch(':id')
  update(
    @Tenant() tenant: StoreTenant,
    @Param('id') id: string,
    @Body() dto: UpdateStoreProductDto,
  ) {
    return this.storeProducts.update(tenant.storeId, id, dto);
  }

  @StoreRole(Role.MANAGER)
  @HttpCode(200)
  @Post(':id/stock-entries')
  stockEntry(
    @Tenant() tenant: StoreTenant,
    @Param('id') id: string,
    @Body() dto: StockEntryDto,
  ) {
    return this.storeProducts.stockEntry(tenant.storeId, id, dto.quantity);
  }

  @StoreRole(Role.MANAGER)
  @HttpCode(200)
  @Post(':id/stock-adjustments')
  stockAdjustment(
    @Tenant() tenant: StoreTenant,
    @Param('id') id: string,
    @Body() dto: StockAdjustmentDto,
  ) {
    return this.storeProducts.stockAdjustment(tenant.storeId, id, dto);
  }

  @StoreRole(Role.MANAGER)
  @Delete(':id')
  remove(@Tenant() tenant: StoreTenant, @Param('id') id: string) {
    return this.storeProducts.remove(tenant.storeId, id);
  }
}
