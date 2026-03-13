import {
  Controller, Get, Put, Post, Delete, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { PropertyContentService } from './property-content.service';
import { UpsertContentDto } from './dto/upsert-content.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('property-content')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertyContentController {
  constructor(private readonly svc: PropertyContentService) {}

  @Get()
  getContent(@Request() req, @Query('propertyId') propertyId?: string) {
    return this.svc.getContent(req.user.organizationId, propertyId || undefined);
  }

  @Put()
  @Roles('admin', 'gestor')
  upsertContent(
    @Request() req,
    @Body() dto: UpsertContentDto,
    @Query('propertyId') propertyId?: string,
  ) {
    return this.svc.upsertContent(req.user.organizationId, dto, propertyId || undefined);
  }

  @Get('documents')
  getDocuments(@Request() req, @Query('propertyId') propertyId?: string) {
    return this.svc.getDocuments(req.user.organizationId, propertyId || undefined);
  }

  @Post('documents')
  @Roles('admin', 'gestor')
  addDocument(
    @Request() req,
    @Body() dto: AddDocumentDto,
    @Query('propertyId') propertyId?: string,
  ) {
    return this.svc.addDocument(req.user.organizationId, dto, propertyId || undefined);
  }

  @Delete('documents/:id')
  @Roles('admin', 'gestor')
  removeDocument(@Request() req, @Param('id') id: string) {
    return this.svc.removeDocument(req.user.organizationId, id);
  }

  @Put('documents/reorder')
  @Roles('admin', 'gestor')
  reorderDocuments(@Request() req, @Body() body: { ids: string[] }) {
    return this.svc.reorderDocuments(req.user.organizationId, body.ids);
  }
}
