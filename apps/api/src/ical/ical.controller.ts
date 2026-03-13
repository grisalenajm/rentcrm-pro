import {
  Controller, Get, Post, Delete, Param, Body,
  UseGuards, Res, HttpCode, Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { ICalService } from './ical.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('ical')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ICalController {
  constructor(private readonly icalService: ICalService) {}

  @Get('feeds')
  @Roles('admin', 'gestor')
  findAll(@Request() req) {
    return this.icalService.findAll(req.user.organizationId);
  }

  @Post('feeds')
  @Roles('admin', 'gestor')
  create(@Body() dto: CreateFeedDto, @Request() req) {
    return this.icalService.create(dto, req.user.organizationId);
  }

  @Delete('feeds/:id')
  @Roles('admin', 'gestor')
  @HttpCode(204)
  remove(@Param('id') id: string, @Request() req) {
    return this.icalService.remove(id, req.user.organizationId);
  }

  @Post('feeds/:id/sync')
  @Roles('admin', 'gestor')
  sync(@Param('id') id: string) {
    return this.icalService.syncFeed(id);
  }

  @Get('export/:propertyId')
  async exportICal(
    @Param('propertyId') propertyId: string,
    @Res() res: Response,
    @Request() req,
  ) {
    const orgId = req.user?.organizationId || '';
    const ical = await this.icalService.exportPropertyICal(propertyId, orgId);
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="property-${propertyId}.ics"`,
    });
    res.send(ical);
  }
}
