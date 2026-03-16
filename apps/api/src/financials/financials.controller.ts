import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { FinancialsService } from './financials.service';
import { CreateFinancialDto } from './dto/create-financial.dto';
import { UpdateFinancialDto } from './dto/update-financial.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('financials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialsController {
  constructor(private financialsService: FinancialsService) {}

  @Get()
  findAll(
    @Request() req,
    @Query('propertyId') propertyId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.financialsService.findAll(req.user.organizationId, { propertyId, type, from, to });
  }

  @Get('summary')
  summary(@Request() req, @Query('from') from?: string, @Query('to') to?: string) {
    return this.financialsService.summary(req.user.organizationId, from, to);
  }

  @Get('property/:propertyId/report')
  getPropertyReport(
    @Request() req,
    @Param('propertyId') propertyId: string,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
  ) {
    return this.financialsService.getPropertyReport(req.user.organizationId, propertyId, year);
  }

  @Get('categories')
  findCategories(@Request() req) {
    return this.financialsService.findCategories(req.user.organizationId);
  }

  @Post()
  @Roles('admin', 'gestor')
  create(@Body() dto: CreateFinancialDto, @Request() req) {
    return this.financialsService.create(dto, req.user.organizationId, req.user.id);
  }

  @Put(':id')
  @Roles('admin', 'gestor')
  update(@Param('id') id: string, @Body() dto: UpdateFinancialDto, @Request() req) {
    return this.financialsService.update(id, dto, req.user.organizationId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string, @Request() req) {
    return this.financialsService.remove(id, req.user.organizationId);
  }
}
