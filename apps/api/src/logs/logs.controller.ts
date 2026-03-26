import { Controller, Get, Delete, Query, Request, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@SkipThrottle()
export class LogsController {
  constructor(private logsService: LogsService) {}

  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('level') level?: string,
    @Query('context') context?: string,
  ) {
    return this.logsService.findAll(
      limit ? Math.min(parseInt(limit, 10), 500) : 200,
      level || undefined,
      context || undefined,
    );
  }

  @Delete()
  @Roles('admin')
  clear() {
    return this.logsService.clear().then(() => ({ ok: true }));
  }
}
