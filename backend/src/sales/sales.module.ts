import { Module } from '@nestjs/common';
import { CommandTabsService } from './command-tabs.service';
import { CommandTabsController, SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  controllers: [SalesController, CommandTabsController],
  providers: [SalesService, CommandTabsService],
  exports: [SalesService, CommandTabsService],
})
export class SalesModule {}
