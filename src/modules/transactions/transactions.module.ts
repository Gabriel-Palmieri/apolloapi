import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionsController } from './transactions.controller.js';
@Module({
  imports: [StockModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
