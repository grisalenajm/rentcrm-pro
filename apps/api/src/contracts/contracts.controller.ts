import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Ip, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ContractsService } from './contracts.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('contracts')
export class ContractsController {
  constructor(private contractsService: ContractsService) {}

  // ── TEMPLATES ─────────────────────────────────────────
  @Get('templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findAllTemplates(@Request() req) {
    return this.contractsService.findAllTemplates(req.user.organizationId);
  }

  @Post('templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createTemplate(@Body() dto: CreateTemplateDto, @Request() req) {
    return this.contractsService.createTemplate(dto, req.user.organizationId);
  }

  @Put('templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateTemplate(@Param('id') id: string, @Body() dto: Partial<CreateTemplateDto>, @Request() req) {
    return this.contractsService.updateTemplate(id, dto, req.user.organizationId);
  }

  @Delete('templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteTemplate(@Param('id') id: string, @Request() req) {
    return this.contractsService.deleteTemplate(id, req.user.organizationId);
  }

  // ── FIRMA PÚBLICA (sin auth, antes de /:id) ───────────
  @Public()
  @Get('sign/:token')
  getByToken(@Param('token') token: string) {
    return this.contractsService.findByToken(token);
  }

  @Public()
  @Post('sign/:token')
  sign(@Param('token') token: string, @Body() dto: SignContractDto, @Ip() ip: string) {
    return this.contractsService.sign(token, dto, ip);
  }

  // ── VISTA HTML pública (antes de /:id) ───────────────
  @Public()
  @Get('view/:token')
  async viewContract(@Param('token') token: string, @Res() res: Response) {
    const html = await this.contractsService.renderContractHtmlByToken(token);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  // ── CONTRACTS ─────────────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  findAll(@Request() req, @Query('bookingId') bookingId?: string) {
    return this.contractsService.findAll(req.user.organizationId, bookingId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(@Param('id') id: string, @Request() req) {
    return this.contractsService.findOne(id, req.user.organizationId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'gestor')
  create(@Body() dto: CreateContractDto, @Request() req) {
    return this.contractsService.create(dto, req.user.organizationId);
  }

  @Post(':id/send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'gestor')
  send(@Param('id') id: string, @Request() req) {
    return this.contractsService.send(id, req.user.organizationId);
  }

  @Post(':id/paperless/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'gestor')
  uploadToPaperless(@Param('id') id: string, @Request() req) {
    return this.contractsService.uploadToPaperless(id, req.user.organizationId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'gestor')
  cancel(@Param('id') id: string, @Request() req) {
    return this.contractsService.cancel(id, req.user.organizationId);
  }
}
