import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { AuthGuard } from '../auth/auth.guard';
import { MovementType } from '@prisma/client';

@UseGuards(AuthGuard)
@Controller('cash-register')
export class CashRegisterController {
  constructor(private cashRegisterService: CashRegisterService) {}

  @Get('current')
  async getCurrent() {
    return this.cashRegisterService.getCurrent();
  }

  @Post('open')
  async open(@Body() body: { initialBalance: number }) {
    return this.cashRegisterService.open(body.initialBalance);
  }

  @Post('close')
  async close() {
    return this.cashRegisterService.close();
  }

  @Post('movement')
  async addMovement(@Body() body: { type: MovementType; amount: number; description?: string }) {
    return this.cashRegisterService.addMovement(body.type, body.amount, body.description);
  }

  @Get('history')
  async getHistory() {
    return this.cashRegisterService.getHistory();
  }
}
