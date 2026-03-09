import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@Request() req, @Query('propertyId') propertyId?: string, @Query('year') year?: string) {
    return this.expensesService.findAll(
      req.user.organizationId,
      propertyId,
      year ? parseInt(year) : undefined,
    );
  }

  @Get('summary')
  summary(@Request() req, @Query('propertyId') propertyId?: string) {
    return this.expensesService.summaryByYear(req.user.organizationId, propertyId);
  }

  @Post()
  create(@Request() req, @Body() body: { propertyId: string; date: string; amount: number; type: string; notes?: string }) {
    return this.expensesService.create(body, req.user.organizationId);
  }

  @Put(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.expensesService.update(parseInt(id), body, req.user.organizationId);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.expensesService.remove(parseInt(id), req.user.organizationId);
  }
}
