import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { ProductsService } from './products.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuditInterceptor } from '../interceptors/audit.interceptor';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  async findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(Number(id));
  }

  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    return this.productsService.findByCode(code);
  }

  @UseGuards(AuthGuard)
  @UseInterceptors(AuditInterceptor)
  @Post()
  async create(@Body() body: CreateProductDto & { modifierId?: number, modifiedEndpoint?: string }) {
    return this.productsService.create(body);
  }

  @UseGuards(AuthGuard)
  @UseInterceptors(AuditInterceptor)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateProductDto & { modifierId?: number, modifiedEndpoint?: string }
  ) {
    return this.productsService.update(Number(id), body);
  }

  @UseGuards(AuthGuard)
  @UseInterceptors(AuditInterceptor)
  @Post(':id/entry')
  async addStock(@Param('id') id: string, @Body() body: { quantity: number, modifierId?: number, modifiedEndpoint?: string }) {
    return this.productsService.addStock(Number(id), body.quantity, body.modifierId, body.modifiedEndpoint);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(Number(id));
  }
}
