import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [MaterialsController],
  providers: [MaterialsService, PrismaService],
})
export class MaterialsModule {}
