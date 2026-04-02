import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Res, NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import bwipjs from 'bwip-js';
import { MaterialsService } from './materials.service.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.materialsService.findAll(type, isActive, search);
  }

  @Get(':id/barcode')
  @SkipThrottle()
  async barcode(@Param('id') id: string, @Res() res: Response) {
    const material = await this.materialsService.findOne(id);
    if (!material) throw new NotFoundException('Material no encontrado');
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: material.barcode,
      scale: 3,
      height: 10,
      includetext: true,
    });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor', 'inventario')
  create(@Body() dto: CreateMaterialDto) {
    return this.materialsService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor', 'inventario')
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.materialsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'inventario')
  remove(@Param('id') id: string) {
    return this.materialsService.remove(id);
  }
}
