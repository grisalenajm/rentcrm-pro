import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { BookingPaymentsService } from './booking-payments.service';
import { CreateBookingPaymentDto } from './dto/create-booking-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('bookings/:bookingId/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingPaymentsController {
  constructor(private bookingPaymentsService: BookingPaymentsService) {}

  @Get()
  findAll(@Param('bookingId') bookingId: string, @Request() req) {
    return this.bookingPaymentsService.findAll(bookingId, req.user.organizationId);
  }

  @Post()
  @Roles('admin', 'gestor')
  create(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateBookingPaymentDto,
    @Request() req,
  ) {
    return this.bookingPaymentsService.create(bookingId, dto, req.user.organizationId);
  }

  @Delete(':id')
  @Roles('admin', 'gestor')
  remove(
    @Param('id') id: string,
    @Param('bookingId') bookingId: string,
    @Request() req,
  ) {
    return this.bookingPaymentsService.remove(id, bookingId, req.user.organizationId);
  }
}
