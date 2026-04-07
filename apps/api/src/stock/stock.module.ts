import { Module } from '@nestjs/common';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [StockController],
  providers: [StockService, PrismaService],
})
export class StockModule {}
