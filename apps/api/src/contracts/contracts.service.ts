import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PaperlessService } from '../paperless/paperless.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { getPublicBaseUrl } from '../common/public-url.helper';
import PDFDocument from 'pdfkit';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  constructor(
    private prisma: PrismaService,
    private paperlessService: PaperlessService,
  ) {}

  async findAllTemplates(organizationId: string) {
    return this.prisma.contractTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(dto: CreateTemplateDto, organizationId: string) {
    return this.prisma.contractTemplate.create({ data: { ...dto, organizationId } });
  }

  async updateTemplate(id: string, dto: Partial<CreateTemplateDto>, organizationId: string) {
    const t = await this.prisma.contractTemplate.findFirst({ where: { id, organizationId } });
    if (!t) throw new NotFoundException('Template no encontrado');
    return this.prisma.contractTemplate.update({ where: { id }, data: dto });
  }

  async deleteTemplate(id: string, organizationId: string) {
    const t = await this.prisma.contractTemplate.findFirst({ where: { id, organizationId } });
    if (!t) throw new NotFoundException('Template no encontrado');
    return this.prisma.contractTemplate.delete({ where: { id } });
  }

  async findAll(organizationId: string, bookingId?: string) {
    return this.prisma.contract.findMany({
      where: { organizationId, ...(bookingId ? { bookingId } : {}) },
      include: {
        template: { select: { name: true, type: true } },
        booking: { include: { client: { select: { firstName: true, lastName: true, email: true } }, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, organizationId },
      include: { template: true, booking: { include: { client: true, property: true } } },
    });
    if (!contract) throw new NotFoundException('Contrato no encontrado');
    return contract;
  }

  async findByToken(token: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { token },
      include: { template: true, booking: { include: { client: true, property: true } } },
    });
    if (!contract) throw new NotFoundException('Contrato no encontrado');
    if (contract.status === 'signed') throw new BadRequestException('Este contrato ya ha sido firmado');
    if (contract.status === 'cancelled') throw new BadRequestException('Este contrato ha sido cancelado');
    return contract;
  }

  async create(dto: CreateContractDto, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, organizationId },
      include: { client: true, property: true },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const template = await this.prisma.contractTemplate.findFirst({
      where: { id: dto.templateId, organizationId },
    });
    if (!template) throw new NotFoundException('Template no encontrado');

    const token = crypto.randomBytes(32).toString('hex');

    return this.prisma.contract.create({
      data: {
        organizationId,
        bookingId: dto.bookingId,
        templateId: dto.templateId,
        depositAmount: dto.depositAmount ?? template.depositAmount,
        token,
        status: 'draft',
      },
      include: {
        template: { select: { name: true, type: true } },
        booking: { include: { client: { select: { firstName: true, lastName: true, email: true } }, property: { select: { name: true } } } },
      },
    });
  }

  async send(id: string, organizationId: string) {
    this.logger.log('Iniciando envío contrato id: ' + id);
    const contract = await this.findOne(id, organizationId);
    if (contract.status !== 'draft' && contract.status !== 'sent') {
      throw new BadRequestException('Solo se pueden enviar contratos en estado borrador o enviado');
    }

    const clientEmail = (contract.booking.client as any).email;
    if (!clientEmail) throw new BadRequestException('El cliente no tiene email registrado');

    this.logger.log('Destinatario: ' + clientEmail);

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org?.smtpHost) {
      throw new BadRequestException('SMTP no configurado. Configúralo en Settings → Organización');
    }

    const smtpPort = Number(org.smtpPort) || 587;
    this.logger.log('SMTP config: ' + org.smtpHost + ':' + smtpPort + ' user:' + org.smtpUser);

    const transporter = nodemailer.createTransport({
      host: org.smtpHost as string,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: org.smtpUser as string, pass: org.smtpPass as string },
    });

    const signUrl = `${getPublicBaseUrl(org as any)}/contracts/sign/${contract.token}`;

    try {
      await transporter.sendMail({
        from: (org as any).smtpFrom || org.smtpUser,
        to: clientEmail,
        subject: `Contrato de alquiler - ${(contract.booking.property as any).name}`,
        html: `
          <h2>Contrato de alquiler</h2>
          <p>Hola ${(contract.booking.client as any).firstName},</p>
          <p>Te enviamos el contrato de alquiler para tu reserva en <strong>${(contract.booking.property as any).name}</strong>.</p>
          <p>Por favor, revisa y firma el contrato haciendo clic en el siguiente enlace:</p>
          <a href="${signUrl}" style="background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">
            Revisar y firmar contrato
          </a>
        `,
      });
      this.logger.log('Email enviado correctamente');
    } catch (err: any) {
      this.logger.error('Error enviando email: ' + err.message);
      this.logger.error('SMTP error detail: ' + JSON.stringify(err));
      throw new BadRequestException(`Error al enviar el email: ${err.message}`);
    }

    return this.prisma.contract.update({ where: { id }, data: { status: 'sent', sentAt: new Date() } });
  }

  async sign(token: string, dto: SignContractDto, ip: string) {
    const contract = await this.findByToken(token);
    const result = await this.prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'signed', signatureImage: dto.signatureImage, signerName: dto.signerName, signerIp: ip, signedAt: new Date() },
    });
    this.logger.log(JSON.stringify({
      event: 'contract_signed',
      contractId: contract.id,
      timestamp: new Date().toISOString(),
    }));
    // Fire and forget — la firma se completa aunque Paperless falle
    this.doUploadToPaperless(result.id, result.organizationId).catch(err =>
      this.logger.warn(`Paperless upload omitido: ${err.message}`),
    );
    return result;
  }

  async cancel(id: string, organizationId: string) {
    const contract = await this.findOne(id, organizationId);
    if (contract.status === 'signed') throw new BadRequestException('No se puede cancelar un contrato firmado');
    return this.prisma.contract.update({ where: { id }, data: { status: 'cancelled' } });
  }

  async uploadToPaperless(id: string, organizationId: string) {
    const contract = await this.findOne(id, organizationId);
    if (contract.status !== 'signed') {
      throw new BadRequestException('Solo se pueden subir contratos firmados a Paperless');
    }
    await this.doUploadToPaperless(id, organizationId);
    return this.findOne(id, organizationId);
  }

  private async doUploadToPaperless(contractId: string, organizationId: string): Promise<void> {
    const contract = await this.findOne(contractId, organizationId);
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return;

    const b = (contract as any).booking;
    const year = new Date(b.checkInDate).getFullYear();
    const clientName = `${b.client.firstName} ${b.client.lastName}`;
    const propertyName = b.property.name;
    const title = `Contrato ${propertyName} - ${clientName} - ${year}`;
    const tags = ['contrato', propertyName, String(year)];

    const pdfBuffer = await this.generateContractPdf(contract, org);
    const docId = await this.paperlessService.uploadDocument(
      (org as any).paperlessUrl,
      (org as any).paperlessToken,
      pdfBuffer,
      title,
      tags,
      b.property.paperlessCorrespondentId ?? null,
      (org as any).paperlessDocTypeId ?? null,
    );

    if (docId !== null) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { paperlessDocumentId: docId },
      });
      this.logger.log(`Contrato ${contractId} subido a Paperless con ID ${docId}`);
    }
  }

  private async generateContractPdf(contract: any, org?: any): Promise<Buffer> {
    const content = this.fillVariables(contract.template.content, contract, org);
    const doc = new PDFDocument({ margin: 60 });
    const chunks: Buffer[] = [];

    return new Promise((resolve) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(16).font('Helvetica-Bold').text(contract.template.name.toUpperCase(), { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(11).font('Helvetica').text(content, { lineGap: 4 });

      if (contract.status === 'signed' && contract.signerName) {
        doc.moveDown(2);
        doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).stroke();
        doc.moveDown(1);

        const sigY = doc.y;
        const colLeft = 60;
        const colRight = 320;
        const colWidth = 220;

        // Columna izquierda: arrendatario
        doc.fontSize(10).text(`Firmado por: ${contract.signerName}`, colLeft, sigY, { width: colWidth });
        if (contract.signedAt) {
          doc.text(`Fecha: ${new Date(contract.signedAt).toLocaleString('es-ES')}`, colLeft, doc.y, { width: colWidth });
        }
        if (contract.signatureImage) {
          const base64Data = contract.signatureImage.replace(/^data:image\/\w+;base64,/, '');
          doc.image(Buffer.from(base64Data, 'base64'), colLeft, doc.y + 4, { width: 180 });
        }

        // Columna derecha: arrendador (mismo sigY)
        doc.fontSize(10).text(`Firma del arrendador: ${contract.template.ownerName}`, colRight, sigY, { width: colWidth });
        if (contract.template.ownerSignature) {
          const base64Data = contract.template.ownerSignature.replace(/^data:image\/\w+;base64,/, '');
          doc.image(Buffer.from(base64Data, 'base64'), colRight, sigY + 16, { width: 180 });
        }
      }

      doc.end();
    });
  }

  private fillVariables(content: string, contract: any, org?: any): string {
    const b = contract.booking;
    const t = contract.template;
    const durationDays = Math.round(
      (new Date(b.checkOutDate).getTime() - new Date(b.checkInDate).getTime()) / 86400000,
    );
    return content
      .replace(/\{\{clienteNombre\}\}/g, `${b.client.firstName} ${b.client.lastName}`)
      .replace(/\{\{clienteDni\}\}/g, b.client.dniPassport || '—')
      .replace(/\{\{client\.docNumber\}\}/g, b.client.dniPassport || '—')
      .replace(/\{\{client\.docType\}\}/g, (b.client as any).docType || '—')
      .replace(/\{\{propietarioNombre\}\}/g, t.ownerName)
      .replace(/\{\{propietarioNif\}\}/g, t.ownerNif)
      .replace(/\{\{propietarioDireccion\}\}/g, t.ownerAddress || '—')
      .replace(/\{\{propiedadDireccion\}\}/g, b.property.address || '—')
      .replace(/\{\{propiedadCiudad\}\}/g, b.property.city || '—')
      .replace(/\{\{property\.cadastralRef\}\}/g, (b.property as any).cadastralRef || '—')
      .replace(/\{\{fechaEntrada\}\}/g, new Date(b.checkInDate).toLocaleDateString('es-ES'))
      .replace(/\{\{fechaSalida\}\}/g, new Date(b.checkOutDate).toLocaleDateString('es-ES'))
      .replace(/\{\{booking\.durationDays\}\}/g, String(durationDays))
      .replace(/\{\{precioTotal\}\}/g, b.totalAmount)
      .replace(/\{\{fianza\}\}/g, String(contract.depositAmount || t.depositAmount || '—'))
      .replace(/\{\{clausulas\}\}/g, t.clauses || '')
      .replace(/\{\{ciudad\}\}/g, b.property.city || '—')
      .replace(/\{\{signCity\}\}/g, b.property.city || '—')
      .replace(/\{\{fecha\}\}/g, new Date(contract.createdAt).toLocaleDateString('es-ES'))
      .replace(/\{\{fechaFirma\}\}/g, contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('es-ES') : '—')
      .replace(/\{\{owner\.bankSwift\}\}/g, org?.bankSwift || '—')
      .replace(/\{\{owner\.bankIban\}\}/g, org?.bankIban || '—')
      .replace(/\{\{owner\.bankBeneficiary\}\}/g, org?.bankBeneficiary || '—');
  }

  async renderContractHtmlByToken(token: string): Promise<string> {
    const contract = await this.prisma.contract.findUnique({
      where: { token },
      include: { template: true, booking: { include: { client: true, property: true } } },
    });
    if (!contract) throw new NotFoundException('Contrato no encontrado');
    const org = await this.prisma.organization.findUnique({ where: { id: contract.organizationId } });
    const content = this.fillVariables(contract.template.content, contract, org);
    const lines = content.split('\n').map(l => `<p>${l || '&nbsp;'}</p>`).join('');

    const signatureSection = contract.status === 'signed' ? `
      <div style="margin-top:40px;padding-top:20px;border-top:2px solid #e2e8f0;">
        <h3 style="color:#1e293b;margin-bottom:20px;">Firma del arrendatario</h3>
        <div style="display:flex;gap:40px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <p style="color:#64748b;font-size:12px;margin-bottom:8px;">Firmado por: <strong>${contract.signerName}</strong></p>
            <p style="color:#64748b;font-size:12px;margin-bottom:8px;">Fecha: <strong>${new Date(contract.signedAt!).toLocaleString('es-ES')}</strong></p>
            <p style="color:#64748b;font-size:12px;margin-bottom:12px;">IP: ${contract.signerIp}</p>
            <img src="${contract.signatureImage}" style="border:1px solid #e2e8f0;border-radius:8px;max-width:300px;background:white;" />
          </div>
          <div>
            <p style="color:#64748b;font-size:12px;margin-bottom:8px;">Firma del arrendador: <strong>${contract.template.ownerName}</strong></p>
            ${contract.template.ownerSignature
              ? `<img src="${contract.template.ownerSignature}" style="border:1px solid #e2e8f0;border-radius:8px;max-width:300px;background:white;margin-top:6px;" />`
              : `<div style="width:250px;height:70px;border:1px dashed #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-top:6px;"><span style="color:#94a3b8;font-size:12px;">Sin firma registrada</span></div>`
            }
          </div>
        </div>
      </div>
    ` : `
      <div style="margin-top:40px;padding-top:20px;border-top:2px solid #e2e8f0;">
        <p style="color:#f59e0b;font-weight:600;">⏳ Contrato pendiente de firma</p>
      </div>
    `;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato — ${contract.booking.property.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; color: #1e293b; background: #f8fafc; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 60px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .header h1 { font-size: 20px; color: #0f172a; letter-spacing: 1px; }
    .content p { line-height: 1.8; margin-bottom: 8px; font-size: 14px; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
    @media print { .print-btn { display: none; } body { background: white; padding: 0; } .container { box-shadow: none; padding: 40px; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
  <div class="container">
    <div class="header">
      <h1>${contract.template.name.toUpperCase()}</h1>
    </div>
    <div class="content">${lines}</div>
    ${signatureSection}
  </div>
</body>
</html>`;
  }

  renderContent(content: string, data: Record<string, string>) {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
  }
}
