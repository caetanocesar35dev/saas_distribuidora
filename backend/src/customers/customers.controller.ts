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
import { CompanyRole, Tenant } from '../common/decorators/access.decorators';
import type {
  CompanyTenant,
  StoreTenant,
} from '../common/decorators/access.decorators';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CustomerPaymentsService } from './customer-payments.service';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  CreatePaymentDto,
  ListCustomersQuery,
  UpdateCustomerDto,
} from './dto/customers.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('companies/:companyId/customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly payments: CustomerPaymentsService,
  ) {}

  @Get()
  list(@Tenant() tenant: CompanyTenant, @Query() query: ListCustomersQuery) {
    return this.customers.list(tenant.companyId, query, {
      role: tenant.role,
      storeIds: tenant.storeIds,
    });
  }

  @Post()
  create(@Tenant() tenant: CompanyTenant, @Body() dto: CreateCustomerDto) {
    return this.customers.create(tenant.companyId, dto, tenant.role);
  }

  @Get(':id')
  get(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.customers.get(tenant.companyId, id);
  }

  @Patch(':id')
  update(
    @Tenant() tenant: CompanyTenant,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(tenant.companyId, id, dto, tenant.role);
  }

  @CompanyRole(Role.MANAGER)
  @Delete(':id')
  remove(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.customers.remove(tenant.companyId, id);
  }

  @CompanyRole(Role.MANAGER)
  @HttpCode(200)
  @Post(':id/restore')
  restore(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.customers.restore(tenant.companyId, id);
  }

  @Get(':id/balances')
  balances(@Tenant() tenant: CompanyTenant, @Param('id') id: string) {
    return this.customers.balances(tenant.companyId, id, {
      role: tenant.role,
      storeIds: tenant.storeIds,
    });
  }

  @Get(':id/payments')
  listPayments(
    @Tenant() tenant: CompanyTenant,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.payments.list(
      tenant.companyId,
      id,
      { role: tenant.role, storeIds: tenant.storeIds },
      query,
    );
  }
}

@ApiTags('customers')
@ApiBearerAuth()
@Controller('stores/:storeId/customers/:customerId/payments')
export class CustomerPaymentsController {
  constructor(private readonly payments: CustomerPaymentsService) {}

  /** `storeId` é a loja onde o dinheiro está sendo recebido (precisa de caixa aberto). */
  @Post()
  pay(
    @Tenant() tenant: StoreTenant,
    @Param('customerId') customerId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.pay(tenant.storeId, tenant.companyId, customerId, dto);
  }
}
