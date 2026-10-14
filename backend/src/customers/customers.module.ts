import { Module } from '@nestjs/common';
import { CustomerPaymentsService } from './customer-payments.service';
import {
  CustomersController,
  CustomerPaymentsController,
} from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController, CustomerPaymentsController],
  providers: [CustomersService, CustomerPaymentsService],
  exports: [CustomersService, CustomerPaymentsService],
})
export class CustomersModule {}
