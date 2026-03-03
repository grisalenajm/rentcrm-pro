import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  findAll(@Request() req, @Query('search') search?: string) {
    return this.clientsService.findAll(req.user.organizationId, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.clientsService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles('admin', 'gestor')
  create(@Body() dto: CreateClientDto, @Request() req) {
    return this.clientsService.create(dto, req.user.organizationId, req.user.id);
  }

  @Put(':id')
  @Roles('admin', 'gestor')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @Request() req) {
    return this.clientsService.update(id, dto, req.user.organizationId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string, @Request() req) {
    return this.clientsService.remove(id, req.user.organizationId);
  }
}
