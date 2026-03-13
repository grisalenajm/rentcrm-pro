import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request, Res, Logger } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { BookingsService } from './bookings.service';
import { SesService } from './ses.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateBookingGuestSesDto } from './dto/booking-guest-ses.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  private readonly logger = new Logger(BookingsController.name);
  constructor(
    private bookingsService: BookingsService,
    private sesService: SesService,
  ) {}

  @Get()
  findAll(@Request() req, @Query('propertyId') propertyId?: string) {
    return this.bookingsService.findAll(req.user.organizationId, propertyId);
  }

  @Public()
  @SkipThrottle()
  @Get('checkin/:token')
  getCheckin(@Param('token') token: string) {
    return this.bookingsService.getCheckinByToken(token);
  }

  @Public()
  @SkipThrottle()
  @Post('checkin/:token')
  completeCheckin(@Param('token') token: string, @Body() body: any) {
    return this.bookingsService.completeCheckin(token, body);
  }

  @Patch(':id/status')
  @Roles('admin', 'gestor')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }, @Request() req) {
    return this.bookingsService.updateStatus(id, body.status, req.user.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.bookingsService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles('admin', 'gestor')
  create(@Body() dto: CreateBookingDto, @Request() req) {
    return this.bookingsService.create(dto, req.user.organizationId, req.user.id);
  }

  @Put(':id')
  @Roles('admin', 'gestor')
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto, @Request() req) {
    return this.bookingsService.update(id, dto, req.user.organizationId);
  }

  @Delete(':id')
  @Roles('admin', 'gestor')
  cancel(@Param('id') id: string, @Request() req) {
    return this.bookingsService.cancel(id, req.user.organizationId);
  }

  // ── Huéspedes SES ──────────────────────────────────────────────────────────
  @Get(':id/guests-ses')
  getGuestsSes(@Param('id') id: string, @Request() req) {
    return this.bookingsService.getGuestsSes(id, req.user.organizationId);
  }

  @Post(':id/guests-ses')
  @Roles('admin', 'gestor')
  addGuestSes(@Param('id') id: string, @Body() dto: CreateBookingGuestSesDto, @Request() req) {
    return this.bookingsService.addGuestSes(id, dto, req.user.organizationId);
  }

  @Delete(':id/guests-ses/:guestId')
  @Roles('admin', 'gestor')
  removeGuestSes(@Param('id') id: string, @Param('guestId') guestId: string, @Request() req) {
    return this.bookingsService.removeGuestSes(id, guestId, req.user.organizationId);
  }

  // ── Checkin Online ─────────────────────────────────────────────────────────
  @Post(':id/checkin/send')
  @Roles('admin', 'gestor')
  async sendCheckin(@Param('id') id: string, @Body() body: { language?: string }, @Request() req) {
    await this.bookingsService.sendCheckinLink(id, req.user.organizationId, body?.language);
    return { ok: true };
  }

  // ── SES Envío ──────────────────────────────────────────────────────────────
  @Post(':id/ses/send')
  @Roles('admin', 'gestor')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async sesSend(@Param('id') id: string, @Request() req) {
    const { organizationId, email: userEmail } = req.user;
    try {
      const result = await this.sesService.sendToSes(id, organizationId);
      if (result.ok) {
        await this.bookingsService.updateStatusOnSesSent(id, organizationId, true);
      } else {
        await this.bookingsService.updateStatusOnSesSent(id, organizationId, false);
        this.bookingsService.sendSesErrorEmail(
          id, organizationId, userEmail,
          `El Ministerio rechazó el parte SES (código de respuesta: ${result.codigo})`,
          result.lote,
        ).catch(e => this.logger.error(JSON.stringify({ event: 'ses_error_email_failed', error: e.message })));
      }
      return result;
    } catch (err) {
      await this.bookingsService.updateStatusOnSesSent(id, organizationId, false);
      this.bookingsService.sendSesErrorEmail(
        id, organizationId, userEmail,
        err.message || 'Error de conexión con el servicio SES del Ministerio',
        null,
      ).catch(e => console.log(JSON.stringify({ event: 'ses_error_email_failed', error: e.message })));
      throw err;
    }
  }

  @Get(':id/ses/xml')
  async sesXml(@Param('id') id: string, @Request() req, @Res() res: Response) {
    const xml = await this.sesService.buildXml(id, req.user.organizationId);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="ses-${id.slice(0,8)}.xml"`);
    res.send(xml);
  }

  @Get(':id/ses/pdf')
  async sesPdf(@Param('id') id: string, @Request() req, @Res() res: Response) {
    const pdf = await this.sesService.buildPdf(id, req.user.organizationId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="parte-ses-${id.slice(0,8)}.pdf"`);
    res.send(pdf);
  }
}
