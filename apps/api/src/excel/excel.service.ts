import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelService {
  constructor(private prisma: PrismaService) {}

  // ─── EXPORTAR ───────────────────────────────────────────

  async exportClients(organizationId: string): Promise<Buffer> {
    const clients = await this.prisma.client.findMany({
      where: { organizationId },
      orderBy: { lastName: 'asc' },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Clientes');
    ws.columns = [
      { header: 'Nombre', key: 'firstName', width: 20 },
      { header: 'Apellidos', key: 'lastName', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Teléfono', key: 'phone', width: 15 },
      { header: 'DNI / Pasaporte', key: 'dniPassport', width: 20 },
      { header: 'Nacionalidad', key: 'nationality', width: 20 },
      { header: 'Notas', key: 'notes', width: 30 },
    ];
    this.styleHeader(ws);
    clients.forEach(c => ws.addRow({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      dniPassport: c.dniPassport,
      nationality: c.nationality,
      notes: c.notes,
    }));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportBookings(organizationId: string): Promise<Buffer> {
    const bookings = await this.prisma.booking.findMany({
      where: { organizationId },
      include: {
        property: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { checkInDate: 'desc' },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Reservas');
    ws.columns = [
      { header: 'Propiedad', key: 'property', width: 25 },
      { header: 'Cliente', key: 'client', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Entrada', key: 'checkInDate', width: 15 },
      { header: 'Salida', key: 'checkOutDate', width: 15 },
      { header: 'Noches', key: 'nights', width: 10 },
      { header: 'Total €', key: 'totalAmount', width: 12 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Origen', key: 'source', width: 15 },
    ];
    this.styleHeader(ws);
    bookings.forEach(b => {
      const nights = Math.round(
        (new Date(b.checkOutDate).getTime() - new Date(b.checkInDate).getTime()) / 86400000,
      );
      ws.addRow({
        property: b.property?.name,
        client: `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.trim(),
        email: b.client?.email,
        checkInDate: new Date(b.checkInDate).toLocaleDateString('es-ES'),
        checkOutDate: new Date(b.checkOutDate).toLocaleDateString('es-ES'),
        nights,
        totalAmount: Number(b.totalAmount),
        status: b.status,
        source: b.source,
      });
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportExpenses(organizationId: string): Promise<Buffer> {
    const expenses = await this.prisma.expense.findMany({
      where: { property: { organizationId } },
      include: { property: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Gastos');
    ws.columns = [
      { header: 'Propiedad', key: 'property', width: 25 },
      { header: 'Fecha', key: 'date', width: 15 },
      { header: 'Tipo', key: 'type', width: 15 },
      { header: 'Importe €', key: 'amount', width: 12 },
      { header: 'Notas', key: 'notes', width: 30 },
    ];
    this.styleHeader(ws);
    expenses.forEach(e => ws.addRow({
      property: e.property?.name,
      date: new Date(e.date).toLocaleDateString('es-ES'),
      type: e.type,
      amount: e.amount,
      notes: e.notes,
    }));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportProperties(organizationId: string): Promise<Buffer> {
    const properties = await this.prisma.property.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Propiedades');
    ws.columns = [
      { header: 'Nombre', key: 'name', width: 25 },
      { header: 'Dirección', key: 'address', width: 30 },
      { header: 'Ciudad', key: 'city', width: 20 },
      { header: 'Provincia', key: 'province', width: 20 },
      { header: 'Habitaciones', key: 'rooms', width: 14 },
      { header: 'Estado', key: 'status', width: 15 },
    ];
    this.styleHeader(ws);
    properties.forEach(p => ws.addRow({
      name: p.name,
      address: p.address,
      city: p.city,
      province: p.province,
      rooms: p.rooms,
      status: p.status,
    }));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── IMPORTAR ───────────────────────────────────────────

  async importClients(buffer: Buffer, organizationId: string): Promise<{ imported: number; errors: string[] }> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet(1);
    if (!ws) throw new BadRequestException('Archivo Excel inválido');
    const errors: string[] = [];
    const rows: any[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const firstName = row.getCell(1).text?.trim();
      const lastName = row.getCell(2).text?.trim();
      if (!firstName || !lastName) {
        errors.push(`Fila ${rowNumber}: Nombre y apellidos son obligatorios`);
        return;
      }
      rows.push({
        firstName,
        lastName,
        email: row.getCell(3).text?.trim() || null,
        phone: row.getCell(4).text?.trim() || null,
        dniPassport: row.getCell(5).text?.trim() || null,
        nationality: row.getCell(6).text?.trim() || null,
        notes: row.getCell(7).text?.trim() || null,
        organizationId,
      });
    });
    if (rows.length > 0) {
      await this.prisma.client.createMany({ data: rows, skipDuplicates: true });
    }
    return { imported: rows.length, errors };
  }

  async importBookings(buffer: Buffer, organizationId: string): Promise<{ imported: number; errors: string[] }> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet(1);
    if (!ws) throw new BadRequestException('Archivo Excel inválido');

    const properties = await this.prisma.property.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    const propMap = new Map(properties.map(p => [p.name.toLowerCase(), p.id]));

    const clients = await this.prisma.client.findMany({
      where: { organizationId },
      select: { id: true, email: true },
    });
    const clientMap = new Map(
      clients.filter(c => c.email).map(c => [c.email!.toLowerCase(), c.id]),
    );

    const VALID_SOURCES = ['direct', 'airbnb', 'booking', 'vrbo', 'manual_block'];
    const errors: string[] = [];

    // Paso 1: parsear todas las filas de forma síncrona
    interface ParsedRow {
      rowNumber: number;
      propertyId: string;
      email: string;
      clientName: string;
      checkInDate: Date;
      checkOutDate: Date;
      totalAmount: number;
      source: string;
      externalId: string | null;
    }
    const parsed: ParsedRow[] = [];

    const parseDate = (str: string, label: string, rowNumber: number): Date | null => {
      const parts = str.split('/');
      if (parts.length !== 3) {
        errors.push(`Fila ${rowNumber}: Fecha ${label} "${str}" inválida. Formato: DD/MM/YYYY`);
        return null;
      }
      const [day, month, year] = parts;
      const d = new Date(`${year}-${month}-${day}`);
      if (isNaN(d.getTime())) {
        errors.push(`Fila ${rowNumber}: Fecha ${label} "${str}" inválida`);
        return null;
      }
      return d;
    };

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const propName    = row.getCell(1).text?.trim();
      const clientEmail = row.getCell(2).text?.trim();
      const clientName  = row.getCell(3).text?.trim();
      const checkInStr  = row.getCell(4).text?.trim();
      const checkOutStr = row.getCell(5).text?.trim();
      const amountStr   = row.getCell(6).text?.trim();
      const sourceRaw   = row.getCell(7).text?.trim().toLowerCase() || 'direct';
      const externalId  = row.getCell(8).text?.trim() || null;

      if (!propName || !checkInStr || !checkOutStr || !amountStr) {
        errors.push(`Fila ${rowNumber}: Propiedad, entrada, salida e importe son obligatorios`);
        return;
      }

      if (!clientEmail && !clientName) {
        errors.push(`Fila ${rowNumber}: Se requiere email o nombre del cliente`);
        return;
      }

      const propertyId = propMap.get(propName.toLowerCase());
      if (!propertyId) {
        errors.push(`Fila ${rowNumber}: Propiedad "${propName}" no encontrada`);
        return;
      }

      const checkInDate  = parseDate(checkInStr, 'entrada', rowNumber);
      const checkOutDate = parseDate(checkOutStr, 'salida', rowNumber);
      if (!checkInDate || !checkOutDate) return;

      if (checkOutDate <= checkInDate) {
        errors.push(`Fila ${rowNumber}: La fecha de salida debe ser posterior a la de entrada`);
        return;
      }

      const totalAmount = parseFloat(amountStr);
      if (isNaN(totalAmount) || totalAmount < 0) {
        errors.push(`Fila ${rowNumber}: Importe "${amountStr}" no válido`);
        return;
      }

      const source = VALID_SOURCES.includes(sourceRaw) ? sourceRaw : 'direct';

      parsed.push({ rowNumber, propertyId, email: clientEmail, clientName, checkInDate, checkOutDate, totalAmount, source, externalId });
    });

    if (parsed.length === 0) return { imported: 0, errors };

    // Paso 2: resolver clientId para cada fila (async — puede crear clientes nuevos)
    interface ResolvedRow {
      rowNumber: number;
      propertyId: string;
      clientId: string;
      checkInDate: Date;
      checkOutDate: Date;
      totalAmount: number;
      source: string;
      externalId: string | null;
    }
    const resolved: ResolvedRow[] = [];

    for (const p of parsed) {
      let clientId: string | null = null;

      if (p.email) {
        clientId = clientMap.get(p.email.toLowerCase()) ?? null;
        if (!clientId) {
          errors.push(`Fila ${p.rowNumber}: Cliente con email "${p.email}" no encontrado`);
          continue;
        }
      } else {
        // Sin email → crear cliente provisional por nombre
        const tokens = p.clientName.split(/\s+/);
        const firstName = tokens[0];
        const lastName  = tokens.length > 1 ? tokens.slice(1).join(' ') : '-';
        const newClient = await this.prisma.client.create({
          data: { firstName, lastName, organizationId, notes: 'Pendiente completar' },
        });
        clientId = newClient.id;
        // Añadir al mapa para evitar crear duplicados si aparece el mismo nombre en el Excel
        clientMap.set(p.clientName.toLowerCase(), clientId);
      }

      resolved.push({
        rowNumber: p.rowNumber,
        propertyId: p.propertyId,
        clientId,
        checkInDate: p.checkInDate,
        checkOutDate: p.checkOutDate,
        totalAmount: p.totalAmount,
        source: p.source,
        externalId: p.externalId,
      });
    }

    if (resolved.length === 0) return { imported: 0, errors };

    // Paso 3: detectar duplicados contra BD y dentro del propio Excel
    const existing = await this.prisma.booking.findMany({
      where: { organizationId },
      select: { propertyId: true, clientId: true, checkInDate: true, checkOutDate: true },
    });
    const existingSet = new Set(
      existing.map(b =>
        `${b.propertyId}|${b.clientId}|${b.checkInDate.toISOString().slice(0, 10)}|${b.checkOutDate.toISOString().slice(0, 10)}`,
      ),
    );

    const newRows: any[] = [];
    for (const r of resolved) {
      const key = `${r.propertyId}|${r.clientId}|${r.checkInDate.toISOString().slice(0, 10)}|${r.checkOutDate.toISOString().slice(0, 10)}`;
      if (existingSet.has(key)) {
        errors.push(`Fila ${r.rowNumber}: Reserva duplicada (misma propiedad, cliente y fechas ya existe)`);
      } else {
        existingSet.add(key);
        newRows.push({ organizationId, propertyId: r.propertyId, clientId: r.clientId, checkInDate: r.checkInDate, checkOutDate: r.checkOutDate, totalAmount: r.totalAmount, source: r.source, externalId: r.externalId });
      }
    }

    if (newRows.length > 0) {
      await this.prisma.booking.createMany({ data: newRows });
    }
    return { imported: newRows.length, errors };
  }

  async importExpenses(buffer: Buffer, organizationId: string): Promise<{ imported: number; errors: string[] }> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet(1);
    if (!ws) throw new BadRequestException('Archivo Excel inválido');
    const properties = await this.prisma.property.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    const propMap = new Map(properties.map(p => [p.name.toLowerCase(), p.id]));
    const VALID_TYPES = ['tasas', 'agua', 'luz', 'internet', 'limpieza', 'otros'];
    const errors: string[] = [];
    const rows: any[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const propName = row.getCell(1).text?.trim();
      const dateStr = row.getCell(2).text?.trim();
      const type = row.getCell(3).text?.trim()?.toLowerCase();
      const amount = parseFloat(row.getCell(4).text?.trim() || '0');
      if (!propName || !dateStr || !type || !amount) {
        errors.push(`Fila ${rowNumber}: Propiedad, fecha, tipo e importe son obligatorios`);
        return;
      }
      const propertyId = propMap.get(propName.toLowerCase());
      if (!propertyId) {
        errors.push(`Fila ${rowNumber}: Propiedad "${propName}" no encontrada`);
        return;
      }
      if (!VALID_TYPES.includes(type)) {
        errors.push(`Fila ${rowNumber}: Tipo "${type}" no válido. Usa: ${VALID_TYPES.join(', ')}`);
        return;
      }
      const [day, month, year] = dateStr.split('/');
      const date = new Date(`${year}-${month}-${day}`);
      if (isNaN(date.getTime())) {
        errors.push(`Fila ${rowNumber}: Fecha "${dateStr}" inválida. Formato: DD/MM/YYYY`);
        return;
      }
      rows.push({ propertyId, date, type, amount, notes: row.getCell(5).text?.trim() || null });
    });
    if (rows.length > 0) await this.prisma.expense.createMany({ data: rows });
    return { imported: rows.length, errors };
  }

  // ─── PLANTILLAS ─────────────────────────────────────────

  async getTemplate(type: 'clients' | 'expenses' | 'bookings'): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Plantilla');
    if (type === 'clients') {
      ws.columns = [
        { header: 'Nombre *', key: 'firstName', width: 20 },
        { header: 'Apellidos *', key: 'lastName', width: 20 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Teléfono', key: 'phone', width: 15 },
        { header: 'DNI / Pasaporte', key: 'dniPassport', width: 20 },
        { header: 'Nacionalidad', key: 'nationality', width: 20 },
        { header: 'Notas', key: 'notes', width: 30 },
      ];
      ws.addRow(['Ejemplo', 'García López', 'ejemplo@email.com', '+34600000000', '12345678A', 'Española', '']);
    } else if (type === 'bookings') {
      ws.columns = [
        { header: 'Propiedad * (nombre exacto)', key: 'property', width: 30 },
        { header: 'Email cliente (si existe)', key: 'clientEmail', width: 28 },
        { header: 'Nombre cliente (si no hay email)', key: 'clientName', width: 28 },
        { header: 'Entrada * (DD/MM/YYYY)', key: 'checkInDate', width: 22 },
        { header: 'Salida * (DD/MM/YYYY)', key: 'checkOutDate', width: 22 },
        { header: 'Total € *', key: 'totalAmount', width: 12 },
        { header: 'Origen (direct/airbnb/booking/vrbo/manual_block)', key: 'source', width: 48 },
        { header: 'ID Externo', key: 'externalId', width: 20 },
      ];
      ws.addRow(['Paradise terrace', 'cliente@ejemplo.com', '', '01/06/2025', '08/06/2025', '490.00', 'airbnb', '']);
      ws.addRow(['Paradise terrace', '', 'Juan García López', '10/07/2025', '17/07/2025', '630.00', 'booking', 'BK-12345']);
    } else {
      ws.columns = [
        { header: 'Propiedad * (nombre exacto)', key: 'property', width: 30 },
        { header: 'Fecha * (DD/MM/YYYY)', key: 'date', width: 22 },
        { header: 'Tipo * (tasas/agua/luz/internet/limpieza/otros)', key: 'type', width: 45 },
        { header: 'Importe € *', key: 'amount', width: 12 },
        { header: 'Notas', key: 'notes', width: 30 },
      ];
      ws.addRow(['Paradise terrace', '01/01/2025', 'luz', '85.50', '']);
    }
    this.styleHeader(ws);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── HELPERS ────────────────────────────────────────────

  private styleHeader(ws: ExcelJS.Worksheet) {
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;
  }
}
