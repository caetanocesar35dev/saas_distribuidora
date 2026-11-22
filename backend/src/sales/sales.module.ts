import { Module } from '@nestjs/common';
import { CommandTabsService } from './command-tabs.service';
import {
  CommandTabsController,
  SaleChannelsController,
  SalesController,
} from './sales.controller';
import { SaleChannelsService } from './sale-channels.service';
import { SalesService } from './sales.service';

@Module({
  controllers: [SalesController, CommandTabsController, SaleChannelsController],
  providers: [SalesService, CommandTabsService, SaleChannelsService],
  exports: [SalesService, CommandTabsService, SaleChannelsService],
})
export class SalesModule {}
