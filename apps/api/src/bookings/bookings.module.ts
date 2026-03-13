import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { CheckinController } from './checkin.controller';
import { SesService } from './ses.service';
import { TranslationModule } from '../translation/translation.module';
import { PropertyContentModule } from '../property-content/property-content.module';

@Module({
  imports: [TranslationModule, PropertyContentModule],
  controllers: [BookingsController, CheckinController],
  providers: [BookingsService, SesService],
  exports: [BookingsService, SesService],
})
export class BookingsModule {}
