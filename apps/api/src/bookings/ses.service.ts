import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LogsService } from '../logs/logs.service';
import * as zlib from 'zlib';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as https from 'https';
import PDFDocument = require('pdfkit');

const deflate = promisify(zlib.deflateRaw);

const SES_ENDPOINTS: Record<string, string> = {
  produccion: 'https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion',
  pruebas:    'https://hospedajes.pre-ses.mir.es/hospedajes-web/ws/v1/comunicacion',
};

const DOC_TYPE_MAP: Record<string, string> = {
  dni: 'NIF', nie: 'NIE', passport: 'PAS', other: 'OTR',
};

const ISO2_TO_3: Record<string, string> = {
  ES:'ESP', DE:'DEU', FR:'FRA', GB:'GBR', IT:'ITA', PT:'PRT',
  NL:'NLD', BE:'BEL', CH:'CHE', AT:'AUT', SE:'SWE', NO:'NOR',
  DK:'DNK', FI:'FIN', PL:'POL', CZ:'CZE', HU:'HUN', RO:'ROU',
  GR:'GRC', US:'USA', CA:'CAN', MX:'MEX', AR:'ARG', BR:'BRA',
  CO:'COL', CL:'CHL', MA:'MAR', CN:'CHN', JP:'JPN', AU:'AUS',
  RU:'RUS', UA:'UKR', TR:'TUR', IN:'IND',
};

/**
 * Loads the MIR CA certificate from the certs/ directory.
 * Returns the cert buffer if found, or undefined to use system defaults.
 * Never uses rejectUnauthorized: false.
 */
function loadMirCa(): Buffer | undefined {
  const certPath = path.join(__dirname, '../../certs/mir-ca.pem');
  try {
    if (fs.existsSync(certPath)) {
      return fs.readFileSync(certPath);
    }
  } catch {
    // Will use system CAs
  }
  return undefined;
}

function buildHttpsAgent(mirCa?: Buffer): https.Agent {
  if (mirCa) {
    return new https.Agent({ ca: mirCa });
  }
  // No custom CA — use system trust store (correct for production FNMT-RCM signed cert)
  return new https.Agent();
}

@Injectable()
export class SesService {
  private readonly logger = new Logger(SesService.name);
  private readonly mirCa: Buffer | undefined;

  constructor(private prisma: PrismaService, private logsService: LogsService) {
    this.mirCa = loadMirCa();
    if (this.mirCa) {
      this.logger.log('MIR CA certificate loaded from certs/mir-ca.pem');
    } else {
      this.logger.log('No custom MIR CA cert found — using system trust store');
    }
  }

  private resolveEndpoint(org: any): string {
    const entorno: string = org.sesEntorno || '';
    if (entorno && SES_ENDPOINTS[entorno]) {
      return SES_ENDPOINTS[entorno];
    }
    // Backward-compat: use sesEndpoint if set
    if (org.sesEndpoint) return org.sesEndpoint;
    return SES_ENDPOINTS['produccion'];
  }

  private escapeXml(s: string): string {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  }

  private formatDate(d: string | Date): string {
    return new Date(d).toISOString().split('T')[0];
  }

  private formatDateTime(d: string | Date): string {
    return new Date(d).toISOString().split('.')[0];
  }

  private buildPersonaXml(p: {
    firstName: string; lastName: string; docType: string;
    docNumber: string; docCountry: string; birthDate?: string | Date | null;
    phone?: string | null; email?: string | null; nationality?: string | null;
  }, rol: string): string {
    const tipoDoc = DOC_TYPE_MAP[p.docType] || 'OTR';
    const nac3    = ISO2_TO_3[p.docCountry] || 'ESP';
    const apellidos = (p.lastName || '').split(' ');
    const apellido1 = this.escapeXml(apellidos[0] || p.lastName);
    const apellido2 = apellidos.length > 1
      ? `<apellido2>${this.escapeXml(apellidos.slice(1).join(' '))}</apellido2>` : '';
    const nacimiento = p.birthDate
      ? `<fechaNacimiento>${this.formatDate(p.birthDate)}</fechaNacimiento>` : '';
    const contacto = p.phone
      ? `<telefono>${this.escapeXml(p.phone)}</telefono>`
      : p.email
        ? `<correo>${this.escapeXml(p.email)}</correo>`
        : `<correo>noreply@placeholder.com</correo>`;
    const nat3 = ISO2_TO_3[p.nationality || ''] || nac3;

    return `
    <persona>
      <rol>${rol}</rol>
      <nombre>${this.escapeXml(p.firstName)}</nombre>
      <apellido1>${apellido1}</apellido1>
      ${apellido2}
      <tipoDocumento>${tipoDoc}</tipoDocumento>
      <numeroDocumento>${this.escapeXml(p.docNumber)}</numeroDocumento>
      ${nacimiento}
      <nacionalidad>${nat3}</nacionalidad>
      <direccion><pais>${nac3}</pais></direccion>
      ${contacto}
    </persona>`;
  }

  private async getBookingData(bookingId: string, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, organizationId },
      include: { client: true, property: true, guestsSes: true },
    });
    if (!booking) throw new BadRequestException('Reserva no encontrada');
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new BadRequestException('Organización no encontrada');
    const codigoEst = (booking.property as any).sesCodigoEstablecimiento
      || (org as any).sesCodigoEstablecimiento || '';
    if (!codigoEst) throw new BadRequestException(
      'La propiedad no tiene código SES configurado. Ve a Propiedades → Editar.'
    );
    return { booking, org, codigoEst };
  }

  /** Builds the parte de viajeros XML (altaParteHospedaje / tipoComunicacion PV) */
  async buildPartViajeros(bookingId: string, organizationId: string): Promise<string> {
    const { booking, codigoEst } = await this.getBookingData(bookingId, organizationId);
    const client = booking.client as any;
    const guestsSes = booking.guestsSes || [];
    const totalPersonas = 1 + guestsSes.length;
    const referencia = booking.id.slice(0, 20);

    const payments = await this.prisma.bookingPayment.findMany({
      where: { bookingId },
      orderBy: { date: 'asc' },
    });
    // Pick first non-deposit payment as tipoPago; default EFE (cash)
    const tipoPago = (() => {
      const p = payments.find(p => p.concept !== 'fianza');
      if (!p) return 'EFE';
      // Map concept to SES payment type
      const map: Record<string, string> = {
        pago_reserva: 'TCR', pago_final: 'TCR', fianza: 'EFE', devolucion_fianza: 'EFE',
      };
      return map[p.concept] || 'EFE';
    })();

    const titularXml = this.buildPersonaXml({
      firstName: client.firstName, lastName: client.lastName,
      docType: 'dni', docNumber: client.dniPassport || 'NODOC',
      docCountry: 'ES', birthDate: client.birthDate,
      phone: client.phone, email: client.email, nationality: client.nationality,
    }, 'VI');

    const guestesXml = guestsSes.map((g: any) =>
      this.buildPersonaXml({
        firstName: g.firstName, lastName: g.lastName,
        docType: g.docType, docNumber: g.docNumber,
        docCountry: g.docCountry, birthDate: g.birthDate,
        phone: g.phone, nationality: g.docCountry,
      }, 'VI')
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<solicitud>
  <codigoEstablecimiento>${this.escapeXml(codigoEst)}</codigoEstablecimiento>
  <comunicacion>
    <contrato>
      <referencia>${this.escapeXml(referencia)}</referencia>
      <fechaContrato>${this.formatDate(booking.createdAt)}</fechaContrato>
      <fechaEntrada>${this.formatDateTime(booking.checkInDate)}</fechaEntrada>
      <fechaSalida>${this.formatDateTime(booking.checkOutDate)}</fechaSalida>
      <numPersonas>${totalPersonas}</numPersonas>
      <internet>true</internet>
      <pago>
        <tipoPago>${tipoPago}</tipoPago>
        <importe>${Number(booking.totalAmount).toFixed(2)}</importe>
      </pago>
    </contrato>
    ${titularXml}
    ${guestesXml}
  </comunicacion>
</solicitud>`;
  }

  /** Alias kept for backward-compat with controller */
  async buildXml(bookingId: string, organizationId: string): Promise<string> {
    return this.buildPartViajeros(bookingId, organizationId);
  }

  async buildPdf(bookingId: string, organizationId: string): Promise<Buffer> {
    const { booking, codigoEst } = await this.getBookingData(bookingId, organizationId);
    const client = booking.client as any;
    const property = booking.property as any;
    const guests = booking.guestsSes || [];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).font('Helvetica-Bold').text('PARTE DE VIAJEROS — SES HOSPEDAJES', { align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#666').text('Real Decreto 933/2021', { align: 'center' });
      doc.moveDown();

      doc.fillColor('#000').fontSize(12).font('Helvetica-Bold').text('ESTABLECIMIENTO');
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Propiedad: ${property.name}`);
      doc.text(`Dirección: ${property.address}, ${property.city}`);
      doc.text(`Código SES: ${codigoEst}`);
      doc.moveDown();

      doc.fontSize(12).font('Helvetica-Bold').text('DATOS DE LA RESERVA');
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Referencia: ${booking.id.slice(0, 20)}`);
      doc.text(`Fecha contrato: ${this.formatDate(booking.createdAt)}`);
      doc.text(`Entrada: ${this.formatDate(booking.checkInDate)}`);
      doc.text(`Salida: ${this.formatDate(booking.checkOutDate)}`);
      doc.text(`Nº personas: ${1 + guests.length}`);
      doc.text(`Importe: €${Number(booking.totalAmount).toFixed(2)}`);
      doc.moveDown();

      const allPersons = [
        { ...client, docType: 'DNI/NIE', docNumber: client.dniPassport, rol: 'Titular' },
        ...guests.map((g: any) => ({ ...g, rol: 'Viajero', docType: g.docType?.toUpperCase() })),
      ];

      doc.fontSize(12).font('Helvetica-Bold').text('VIAJEROS');
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      allPersons.forEach((p, i) => {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5276')
          .text(`${i + 1}. ${p.firstName} ${p.lastName} (${p.rol})`);
        doc.fontSize(10).font('Helvetica').fillColor('#000');
        if (p.docNumber) doc.text(`   Documento: ${p.docType} — ${p.docNumber}`);
        if (p.birthDate) doc.text(`   F. Nacimiento: ${this.formatDate(p.birthDate)}`);
        if (p.phone) doc.text(`   Teléfono: ${p.phone}`);
        if (p.email) doc.text(`   Email: ${p.email}`);
        doc.moveDown(0.5);
      });

      doc.moveDown();
      doc.fontSize(8).fillColor('#999')
        .text(`Generado por RentalSuite · ${new Date().toLocaleString('es-ES')}`, { align: 'center' });

      doc.end();
    });
  }

  async sendToSes(bookingId: string, organizationId: string): Promise<any> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new BadRequestException('Organización no encontrada');

    const sesUser       = (org as any).sesUsuarioWs;
    const sesPass       = (org as any).sesPasswordWs;
    const sesArrendador = (org as any).sesCodigoArrendador;
    const sesEndpoint   = this.resolveEndpoint(org);

    if (!sesUser || !sesPass || !sesArrendador || !sesEndpoint)
      throw new BadRequestException('Credenciales SES incompletas. Ve a Configuración → SES Hospedajes.');

    const xml = await this.buildPartViajeros(bookingId, organizationId);
    const compressed = await deflate(Buffer.from(xml, 'utf-8'));
    const base64 = compressed.toString('base64');
    const token = Buffer.from(`${sesUser}:${sesPass}`).toString('base64');

    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="http://hospedajes.ses.mir.es/">
  <soapenv:Header/>
  <soapenv:Body>
    <com:comunicacion>
      <peticion>
        <cabecera>
          <arrendador>${sesArrendador}</arrendador>
          <aplicacion>RentalSuite</aplicacion>
          <tipoOperacion>A</tipoOperacion>
          <tipoComunicacion>PV</tipoComunicacion>
        </cabecera>
        <solicitud>${base64}</solicitud>
      </peticion>
    </com:comunicacion>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await axios.post(sesEndpoint, soapBody, {
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'Authorization': `Basic ${token}`,
          'SOAPAction': 'comunicacion',
        },
        timeout: 30000,
        httpsAgent: buildHttpsAgent(this.mirCa),
      });

      const loteMatch   = response.data.match(/<lote>([^<]+)<\/lote>/);
      const codigoMatch = response.data.match(/<codigo>([^<]+)<\/codigo>/);
      const lote   = loteMatch   ? loteMatch[1]   : null;
      const codigo = codigoMatch ? codigoMatch[1] : null;

      const ok = codigo === '0';
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          sesLote: lote,
          sesStatus: ok ? 'enviado' : 'error',
          sesError: ok ? null : `Ministerio rechazó el parte (código ${codigo})`,
          sesSentAt: new Date(),
        },
      });

      this.logger.log(JSON.stringify({ event: 'ses_send', bookingId, status: ok ? 'success' : 'error', lote, timestamp: new Date().toISOString() }));
      await this.logsService.add(ok ? 'info' : 'error', 'ses', ok ? `Parte SES enviado correctamente (lote ${lote})` : `SES rechazó el parte (código ${codigo})`, { bookingId, lote, codigo });
      return { ok, lote, codigo };
    } catch (err: any) {
      const errorMsg = err.response?.data ? String(err.response.data).slice(0, 500) : err.message;
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { sesStatus: 'error', sesError: errorMsg, sesSentAt: new Date() },
      });
      this.logger.error(JSON.stringify({ event: 'ses_send', errMsg: err.message, bookingId, status: 'error' }));
      await this.logsService.add('error', 'ses', `Error al enviar parte SES: ${err.message}`, { bookingId, error: errorMsg });
      throw new BadRequestException(`Error al enviar al SES: ${err.message}`);
    }
  }

  async consultarLote(bookingId: string, organizationId: string): Promise<any> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new BadRequestException('Organización no encontrada');

    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, organizationId } });
    if (!booking) throw new BadRequestException('Reserva no encontrada');
    if (!(booking as any).sesLote) throw new BadRequestException('Esta reserva no tiene número de lote SES');

    const sesUser       = (org as any).sesUsuarioWs;
    const sesPass       = (org as any).sesPasswordWs;
    const sesArrendador = (org as any).sesCodigoArrendador;
    const sesEndpoint   = this.resolveEndpoint(org);

    if (!sesUser || !sesPass || !sesArrendador)
      throw new BadRequestException('Credenciales SES incompletas.');

    const token = Buffer.from(`${sesUser}:${sesPass}`).toString('base64');
    const lote  = (booking as any).sesLote;

    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="http://hospedajes.ses.mir.es/">
  <soapenv:Header/>
  <soapenv:Body>
    <com:comunicacion>
      <peticion>
        <cabecera>
          <arrendador>${this.escapeXml(sesArrendador)}</arrendador>
          <aplicacion>RentalSuite</aplicacion>
          <tipoOperacion>C</tipoOperacion>
          <tipoComunicacion>PV</tipoComunicacion>
          <lote>${this.escapeXml(lote)}</lote>
        </cabecera>
        <solicitud></solicitud>
      </peticion>
    </com:comunicacion>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await axios.post(sesEndpoint, soapBody, {
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'Authorization': `Basic ${token}`,
          'SOAPAction': 'comunicacion',
        },
        timeout: 15000,
        httpsAgent: buildHttpsAgent(this.mirCa),
        validateStatus: () => true,
      });

      const estadoMatch  = response.data.match(/<estado>([^<]+)<\/estado>/);
      const codigoMatch  = response.data.match(/<codigo>([^<]+)<\/codigo>/);
      const mensajeMatch = response.data.match(/<mensaje>([^<]+)<\/mensaje>/);

      return {
        ok: response.status < 400,
        lote,
        estado:  estadoMatch  ? estadoMatch[1]  : null,
        codigo:  codigoMatch  ? codigoMatch[1]  : null,
        mensaje: mensajeMatch ? mensajeMatch[1] : null,
        raw: String(response.data).slice(0, 1000),
      };
    } catch (err: any) {
      throw new BadRequestException(`Error al consultar lote SES: ${err.message}`);
    }
  }

  async testConnection(sesEndpoint: string, sesUsuarioWs: string, sesPasswordWs: string, sesCodigoArrendador: string): Promise<{ ok: boolean; message: string }> {
    const token = Buffer.from(`${sesUsuarioWs}:${sesPasswordWs}`).toString('base64');
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="http://hospedajes.ses.mir.es/">
  <soapenv:Header/>
  <soapenv:Body>
    <com:comunicacion>
      <peticion>
        <cabecera>
          <arrendador>${this.escapeXml(sesCodigoArrendador)}</arrendador>
          <aplicacion>RentalSuite</aplicacion>
          <tipoOperacion>A</tipoOperacion>
          <tipoComunicacion>PV</tipoComunicacion>
        </cabecera>
        <solicitud></solicitud>
      </peticion>
    </com:comunicacion>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await axios.post(sesEndpoint, soapBody, {
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'Authorization': `Basic ${token}`,
          'SOAPAction': 'comunicacion',
        },
        timeout: 15000,
        httpsAgent: buildHttpsAgent(this.mirCa),
        validateStatus: () => true,
      });
      if (response.status === 200 || response.status === 400 || response.status === 500) {
        return { ok: true, message: 'Conexión establecida con el Ministerio' };
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: `Credenciales rechazadas (HTTP ${response.status}) — verifica usuario y contraseña` };
      }
      if (response.status === 404) {
        return { ok: false, message: 'Endpoint no encontrado (HTTP 404) — verifica que has seleccionado el entorno correcto' };
      }
      return { ok: false, message: `Respuesta inesperada: HTTP ${response.status}` };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') return { ok: false, message: 'Conexión rechazada — endpoint no accesible' };
      if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') return { ok: false, message: 'Timeout — el servidor no responde' };
      if (err.code === 'ENOTFOUND') return { ok: false, message: 'No se puede resolver el host — verifica el endpoint' };
      if (err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || err.code === 'CERT_HAS_EXPIRED') {
        return { ok: false, message: `Error SSL: ${err.code} — consulta docs/SES_INTEGRACION.md para importar el certificado CA del Ministerio` };
      }
      return { ok: false, message: `Error de conexión: ${err.message}` };
    }
  }
}
