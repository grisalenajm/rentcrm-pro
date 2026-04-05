import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { StockService } from './stock.service.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { RecountDto } from './dto/recount.dto.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('stock')
@UseGuards(RolesGuard)
@Roles('admin', 'gestor', 'owner', 'viewer', 'inventario')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // Ruta fija antes de /:propertyId para evitar conflicto
  @Post('movement')
  createMovement(@Body() dto: CreateStockMovementDto, @Request() req) {
    return this.stockService.createMovement(dto, req.user.id);
  }

  @Post('recount/:propertyId')
  @SkipThrottle()
  recount(@Param('propertyId') propertyId: string, @Body() dto: RecountDto, @Request() req) {
    return this.stockService.recount(propertyId, dto, req.user.id);
  }

  @Get(':propertyId/movements')
  getMovements(
    @Param('propertyId') propertyId: string,
    @Query('materialId') materialId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.stockService.getMovements(propertyId, { materialId, type, from, to });
  }

  @Get(':propertyId/valuation')
  getValuation(@Param('propertyId') propertyId: string) {
    return this.stockService.getValuation(propertyId);
  }

  @Get(':propertyId')
  getStock(@Param('propertyId') propertyId: string) {
    return this.stockService.getStock(propertyId);
  }
}
