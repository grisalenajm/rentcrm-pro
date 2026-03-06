import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { SesService } from './ses.service';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, SesService],
  exports: [BookingsService, SesService],
})
export class BookingsModule {}
