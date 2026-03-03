import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('properties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Get()
  findAll(@Request() req) {
    return this.propertiesService.findAll(req.user.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.propertiesService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles('admin', 'gestor')
  create(@Body() dto: CreatePropertyDto, @Request() req) {
    return this.propertiesService.create(dto, req.user.organizationId, req.user.id);
  }

  @Put(':id')
  @Roles('admin', 'gestor')
  update(@Param('id') id: string, @Body() dto: UpdatePropertyDto, @Request() req) {
    return this.propertiesService.update(id, dto, req.user.organizationId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string, @Request() req) {
    return this.propertiesService.remove(id, req.user.organizationId);
  }
}
