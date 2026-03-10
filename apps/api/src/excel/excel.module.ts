import { Module } from '@nestjs/common';
import { ExcelController } from './excel.controller';
import { ExcelService } from './excel.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ExcelController],
  providers: [ExcelService, PrismaService],
})
export class ExcelModule {}
