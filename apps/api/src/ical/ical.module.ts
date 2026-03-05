import { Module } from '@nestjs/common';
import { ICalService } from './ical.service';
import { ICalController } from './ical.controller';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ICalService],
  controllers: [ICalController],
})
export class ICalModule {}
