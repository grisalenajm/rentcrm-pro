import { Controller, Get, Put, Body, Request, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  @Get()
  findOne(@Request() req) {
    return this.organizationService.findOne(req.user.organizationId);
  }

  @Put()
  @Roles('admin')
  update(@Request() req, @Body() dto: any) {
    return this.organizationService.update(req.user.organizationId, dto);
  }
}
