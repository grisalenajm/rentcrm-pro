import { Module } from '@nestjs/common';
import { SesController } from './ses.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [BookingsModule, OrganizationModule],
  controllers: [SesController],
})
export class SesModule {}
