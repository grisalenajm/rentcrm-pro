import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, Max, MaxLength, Min,
} from 'class-validator';
import { RecurringExpensesService } from './recurring-expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const EXPENSE_TYPES   = ['tasas', 'agua', 'luz', 'internet', 'limpieza', 'otros'] as const;
const FREQUENCIES     = ['monthly', 'quarterly', 'yearly'] as const;

class CreateRecurringExpenseDto {
  @IsString()  propertyId:  string;
  @IsEnum(EXPENSE_TYPES)  type: string;
  @IsNumber()  @Min(0)      amount: number;
  @IsOptional() @IsBoolean() deductible?: boolean;
  @IsEnum(FREQUENCIES)     frequency: string;
  @IsInt() @Min(1) @Max(28) dayOfMonth: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsString()  nextRunDate: string;
}

class UpdateRecurringExpenseDto {
  @IsOptional() @IsEnum(EXPENSE_TYPES)  type?: string;
  @IsOptional() @IsNumber() @Min(0)     amount?: number;
  @IsOptional() @IsBoolean()            deductible?: boolean;
  @IsOptional() @IsEnum(FREQUENCIES)    frequency?: string;
  @IsOptional() @IsInt() @Min(1) @Max(28) dayOfMonth?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsString()             nextRunDate?: string;
  @IsOptional() @IsBoolean()            active?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('recurring-expenses')
export class RecurringExpensesController {
  constructor(private readonly service: RecurringExpensesService) {}

  @Get()
  findAll(@Request() req, @Query('propertyId') propertyId?: string) {
    return this.service.findAll(req.user.organizationId, propertyId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'owner')
  create(@Request() req, @Body() body: CreateRecurringExpenseDto) {
    return this.service.create(body, req.user.organizationId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'owner')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateRecurringExpenseDto) {
    return this.service.update(id, body, req.user.organizationId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'owner')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(id, req.user.organizationId);
  }
}
