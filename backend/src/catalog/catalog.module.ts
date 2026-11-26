import { Module } from '@nestjs/common';
import { BottleTypesService } from './bottle-types.service';
import {
  BottleTypesController,
  ProductCategoriesController,
  ProductsController,
  StoreProductsController,
} from './catalog.controllers';
import { ProductCategoriesService } from './product-categories.service';
import { ProductsService } from './products.service';
import { StoreProductsService } from './store-products.service';

@Module({
  controllers: [
    ProductsController,
    BottleTypesController,
    ProductCategoriesController,
    StoreProductsController,
  ],
  providers: [
    ProductsService,
    StoreProductsService,
    BottleTypesService,
    ProductCategoriesService,
  ],
  exports: [
    ProductsService,
    StoreProductsService,
    BottleTypesService,
    ProductCategoriesService,
  ],
})
export class CatalogModule {}
