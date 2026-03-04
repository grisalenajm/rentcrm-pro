import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private evaluationsService: EvaluationsService) {}

  @Post()
  @Roles('admin', 'gestor')
  create(@Body() dto: CreateEvaluationDto, @Request() req) {
    return this.evaluationsService.create(dto, req.user.id);
  }

  @Put(':id')
  @Roles('admin', 'gestor')
  update(@Param('id') id: string, @Body() dto: Partial<CreateEvaluationDto>) {
    return this.evaluationsService.update(id, dto);
  }

  @Get('client/:clientId')
  findByClient(@Param('clientId') clientId: string, @Request() req) {
    return this.evaluationsService.findByClient(clientId, req.user.organizationId);
  }

  @Get('booking/:bookingId')
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.evaluationsService.findByBooking(bookingId);
  }

  @Get('client/:clientId/summary')
  clientSummary(@Param('clientId') clientId: string, @Request() req) {
    return this.evaluationsService.clientSummary(clientId, req.user.organizationId);
  }
}
