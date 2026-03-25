import { Module } from '@nestjs/common';
import { BookingPaymentsService } from './booking-payments.service';
import { BookingPaymentsController } from './booking-payments.controller';

@Module({
  controllers: [BookingPaymentsController],
  providers: [BookingPaymentsService],
})
export class BookingPaymentsModule {}
