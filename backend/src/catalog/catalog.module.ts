import { Module } from '@nestjs/common';
import { BottleTypesService } from './bottle-types.service';
import {
  BottleTypesController,
  ProductsController,
  StoreProductsController,
} from './catalog.controllers';
import { ProductsService } from './products.service';
import { StoreProductsService } from './store-products.service';

@Module({
  controllers: [
    ProductsController,
    BottleTypesController,
    StoreProductsController,
  ],
  providers: [ProductsService, StoreProductsService, BottleTypesService],
  exports: [ProductsService, StoreProductsService, BottleTypesService],
})
export class CatalogModule {}
