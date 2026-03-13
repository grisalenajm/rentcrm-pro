import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BookingsService } from './bookings.service';
import { CompleteCheckinDto } from './dto/complete-checkin.dto';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('checkin')
export class CheckinController {
  constructor(private bookingsService: BookingsService) {}

  @Get(':token')
  getCheckin(@Param('token') token: string) {
    return this.bookingsService.getCheckinByToken(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':token')
  completeCheckin(@Param('token') token: string, @Body() dto: CompleteCheckinDto) {
    return this.bookingsService.completeCheckin(token, dto);
  }
}
