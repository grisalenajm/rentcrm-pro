import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Controller('checkin')
export class CheckinController {
  constructor(private bookingsService: BookingsService) {}

  @Get(':token')
  getCheckin(@Param('token') token: string) {
    return this.bookingsService.getCheckinByToken(token);
  }

  @Post(':token')
  completeCheckin(@Param('token') token: string, @Body() body: any) {
    return this.bookingsService.completeCheckin(token, body);
  }
}
