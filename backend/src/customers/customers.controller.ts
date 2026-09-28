import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { AuthGuard } from '../auth/auth.guard';
import { PaymentMethod } from '@prisma/client';

@UseGuards(AuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@Body() body: { name: string; phone?: string }) {
    return this.customersService.create(body);
  }

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; phone?: string }) {
    return this.customersService.update(+id, body);
  }

  @Post(':id/pay')
  payDebt(@Param('id') id: string, @Body() body: { amount: number; paymentMethod: PaymentMethod }) {
    return this.customersService.payDebt(+id, body.amount, body.paymentMethod);
  }
}
