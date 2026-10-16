import { Module } from '@nestjs/common';
import { BottleMovementsService } from './bottle-movements.service';
import { BottlesController } from './bottles.controller';

@Module({
  controllers: [BottlesController],
  providers: [BottleMovementsService],
  exports: [BottleMovementsService],
})
export class BottlesModule {}
