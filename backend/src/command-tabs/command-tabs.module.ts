import { Module } from '@nestjs/common';
import { CommandTabsService } from './command-tabs.service';
import { CommandTabsController } from './command-tabs.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [SalesModule],
  controllers: [CommandTabsController],
  providers: [CommandTabsService, PrismaService],
})
export class CommandTabsModule {}
