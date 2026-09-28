import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CommandTabsService } from './command-tabs.service';

@Controller('command-tabs')
export class CommandTabsController {
  constructor(private readonly commandTabsService: CommandTabsService) {}

  @Post()
  create(@Body() createCommandTabDto: { name: string; customerId?: number }) {
    return this.commandTabsService.create(createCommandTabDto);
  }

  @Get()
  findAllOpen() {
    return this.commandTabsService.findAllOpen();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.commandTabsService.findOne(+id);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() body: { productId: number; quantity: number }) {
    return this.commandTabsService.addItem(+id, body.productId, body.quantity);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.commandTabsService.removeItem(+id, +itemId);
  }

  @Post(':id/close')
  closeTab(@Param('id') id: string, @Body() body: { paymentMethod: any; discount?: number; customerId?: number }) {
    return this.commandTabsService.closeTab(+id, body.paymentMethod, body.discount, body.customerId);
  }
}
