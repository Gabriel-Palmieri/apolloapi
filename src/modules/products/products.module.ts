import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { StockModule } from '../stock/stock.module.js';
@Module({
  imports: [StockModule],
  providers: [ProductsService],
  controllers: [ProductsController],
})
export class ProductsModule {}
