import { Module } from '@nestjs/common';
import { BottlesService } from './bottles.service';
import { BottlesController } from './bottles.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BottlesController],
  providers: [BottlesService],
  exports: [BottlesService],
})
export class BottlesModule {}
