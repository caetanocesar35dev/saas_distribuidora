import { Module } from '@nestjs/common';
import { BottleMovementsService } from './bottle-movements.service';
import { BottlesController, SuppliersController } from './bottles.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [BottlesController, SuppliersController],
  providers: [BottleMovementsService, SuppliersService],
  exports: [BottleMovementsService, SuppliersService],
})
export class BottlesModule {}
