import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@Query('propertyId') propertyId?: string, @Query('year') year?: string) {
    return this.expensesService.findAll(
      propertyId,
      year ? parseInt(year) : undefined,
    );
  }

  @Get('summary')
  summary(@Query('propertyId') propertyId?: string) {
    return this.expensesService.summaryByYear(propertyId);
  }

  @Post()
  create(@Body() body: { propertyId: string; date: string; amount: number; type: string; notes?: string }) {
    return this.expensesService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.expensesService.update(parseInt(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(parseInt(id));
  }
}
