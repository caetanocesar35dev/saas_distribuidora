import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { BottlesService } from './bottles.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('bottles')
@UseGuards(AuthGuard)
export class BottlesController {
  constructor(private readonly bottlesService: BottlesService) {}

  // =====================
  // BOTTLE TYPES
  // =====================

  @Get('types')
  findAllTypes() {
    return this.bottlesService.findAllTypes();
  }

  @Post('types')
  createType(@Body() createDto: { name: string; initialStock?: number }) {
    return this.bottlesService.createType(createDto);
  }

  @Put('types/:id')
  updateType(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateDto: { name?: string; stock?: number }
  ) {
    return this.bottlesService.updateType(id, updateDto);
  }

  @Delete('types/:id')
  deleteType(@Param('id', ParseIntPipe) id: number) {
    return this.bottlesService.deleteType(id);
  }

  // =====================
  // MOVEMENTS & CUSTOMERS
  // =====================

  @Post('movement')
  registerMovement(
    @Body() movementDto: {
      bottleTypeId: number;
      quantity: number;
      type: 'CUSTOMER_BORROW' | 'CUSTOMER_RETURN' | 'SUPPLIER_SEND' | 'SUPPLIER_RECEIVE' | 'MANUAL_ADJUSTMENT';
      customerId?: number;
      description?: string;
    }
  ) {
    return this.bottlesService.registerMovement(movementDto);
  }

  @Get('customer/:customerId')
  getCustomerBalances(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.bottlesService.getCustomerBalances(customerId);
  }

  @Get('movements')
  getRecentMovements() {
    return this.bottlesService.getRecentMovements();
  }
}
