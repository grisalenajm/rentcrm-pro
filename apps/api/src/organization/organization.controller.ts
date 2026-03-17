import { Controller, Get, Put, Post, Body, Request, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { SesService } from '../bookings/ses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(
    private organizationService: OrganizationService,
    private sesService: SesService,
  ) {}

  @Get()
  findOne(@Request() req) {
    return this.organizationService.findOne(req.user.organizationId);
  }

  @Put()
  @Roles('admin')
  update(@Request() req, @Body() dto: any) {
    return this.organizationService.update(req.user.organizationId, dto);
  }

  @Post('test-smtp')
  @Roles('admin')
  testSmtp(@Request() req, @Body() body: { email: string }) {
    return this.organizationService.testSmtp(req.user.organizationId, body.email);
  }

  @Post('test-paperless')
  @Roles('admin')
  testPaperless(@Request() req) {
    return this.organizationService.testPaperless(req.user.organizationId);
  }

  @Post('test-ses')
  @Roles('admin')
  async testSes(@Request() req) {
    const org = await this.organizationService.findOne(req.user.organizationId);
    return this.sesService.testConnection(
      org.sesEndpoint,
      org.sesUsuarioWs,
      org.sesPasswordWs,
      org.sesCodigoArrendador,
    );
  }
}
