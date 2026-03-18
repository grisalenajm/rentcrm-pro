import { Controller, Get, Post, Param, Query, Res, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ExcelService } from './excel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('excel')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  // Exportar
  @Get('export/clients')
  async exportClients(@Request() req, @Res() res: Response) {
    const buffer = await this.excelService.exportClients(req.user.organizationId);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="clientes.xlsx"' });
    res.send(buffer);
  }

  @Get('export/bookings')
  async exportBookings(@Request() req, @Res() res: Response) {
    const buffer = await this.excelService.exportBookings(req.user.organizationId);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="reservas.xlsx"' });
    res.send(buffer);
  }

  @Get('export/expenses')
  async exportExpenses(@Request() req, @Res() res: Response) {
    const buffer = await this.excelService.exportExpenses(req.user.organizationId);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="gastos.xlsx"' });
    res.send(buffer);
  }

  @Get('export/properties')
  async exportProperties(@Request() req, @Res() res: Response) {
    const buffer = await this.excelService.exportProperties(req.user.organizationId);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="propiedades.xlsx"' });
    res.send(buffer);
  }

  @Get('export/nrua')
  async exportNrua(@Request() req, @Query('propertyId') propertyId: string, @Query('year') year: string, @Res() res: Response) {
    const { csv, filename } = await this.excelService.exportNrua(propertyId, year, req.user.organizationId);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
    res.send(csv);
  }

  // Plantillas
  @Get('template/:type')
  async getTemplate(@Param('type') type: 'clients' | 'expenses' | 'bookings', @Res() res: Response) {
    const buffer = await this.excelService.getTemplate(type);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="plantilla_${type}.xlsx"` });
    res.send(buffer);
  }

  // Importar
  @Post('import/clients')
  @UseInterceptors(FileInterceptor('file'))
  async importClients(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) throw new Error('No se recibió ningún archivo');
    return this.excelService.importClients(file.buffer, req.user.organizationId);
  }

  @Post('import/expenses')
  @UseInterceptors(FileInterceptor('file'))
  async importExpenses(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) throw new Error('No se recibió ningún archivo');
    return this.excelService.importExpenses(file.buffer, req.user.organizationId);
  }

  @Post('import/bookings')
  @UseInterceptors(FileInterceptor('file'))
  async importBookings(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) throw new Error('No se recibió ningún archivo');
    return this.excelService.importBookings(file.buffer, req.user.organizationId);
  }
}
