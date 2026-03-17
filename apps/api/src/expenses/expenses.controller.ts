import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const EXPENSE_TYPES = ['tasas', 'agua', 'luz', 'internet', 'limpieza', 'otros'] as const;

class CreateExpenseDto {
  @IsString() propertyId: string;
  @IsString() date: string;
  @IsNumber() @Min(0) amount: number;
  @IsEnum(EXPENSE_TYPES, { message: 'Tipo de gasto no válido' }) type: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsBoolean() deductible?: boolean;
}

class UpdateExpenseDto {
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsEnum(EXPENSE_TYPES, { message: 'Tipo de gasto no válido' }) type?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsBoolean() deductible?: boolean;
}

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
  @UseGuards(RolesGuard)
  @Roles('admin', 'owner')
  create(@Request() req, @Body() body: CreateExpenseDto) {
    return this.expensesService.create(body, req.user.organizationId);
  }

  @Put(':id')
  @SkipThrottle()
  @UseGuards(RolesGuard)
  @Roles('admin', 'owner')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateExpenseDto) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) throw new BadRequestException('ID de gasto inválido');
    return this.expensesService.update(numId, body, req.user.organizationId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'owner')
  remove(@Request() req, @Param('id') id: string) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) throw new BadRequestException('ID de gasto inválido');
    return this.expensesService.remove(numId, req.user.organizationId);
  }
}
