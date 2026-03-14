import { Controller, Get, Put, Post, Param, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PropertyRulesService } from './property-rules.service';
import { UpsertPropertyRulesDto } from './dto/upsert-property-rules.dto';

@Controller('properties/:id/rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertyRulesController {
  constructor(private propertyRulesService: PropertyRulesService) {}

  @Get()
  getRules(@Param('id') id: string, @Request() req) {
    return this.propertyRulesService.getRules(id, req.user.organizationId);
  }

  @Put()
  @Roles('admin', 'gestor')
  upsertRules(@Param('id') id: string, @Body() dto: UpsertPropertyRulesDto, @Request() req) {
    return this.propertyRulesService.upsertRules(id, req.user.organizationId, dto);
  }

  @Post('translate')
  @Roles('admin', 'gestor')
  translateRules(@Param('id') id: string, @Request() req) {
    return this.propertyRulesService.translateRules(id, req.user.organizationId);
  }
}
