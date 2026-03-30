import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organización no encontrada');
    const { smtpPass, paperlessToken, ...rest } = org as any;
    return { ...rest, smtpPassSet: !!smtpPass, paperlessTokenSet: !!paperlessToken };
  }

  async update(id: string, dto: any) {
    const data: any = {};
    const stringFields = ['name','nif','address','phone','email','logo','publicUrl','publicBaseUrl','smtpHost','smtpUser','smtpFrom','currency','dateFormat','sesUsuarioWs','sesPasswordWs','sesCodigoArrendador','sesEndpoint','sesEntorno','paperlessUrl','paperlessToken','paperlessSecret','bankSwift','bankIban','bankBeneficiary'];
    stringFields.forEach(f => { if (dto[f] !== undefined) data[f] = dto[f]; });
    if (dto.smtpPass) data.smtpPass = dto.smtpPass;

    // smtpPort siempre como Int
    if (dto.smtpPort !== undefined) {
      const port = parseInt(dto.smtpPort, 10);
      data.smtpPort = isNaN(port) ? null : port;
    }

    // paperlessDocTypeId siempre como Int
    if (dto.paperlessDocTypeId !== undefined) {
      const docTypeId = parseInt(dto.paperlessDocTypeId, 10);
      data.paperlessDocTypeId = isNaN(docTypeId) ? null : docTypeId;
    }

    return this.prisma.organization.update({ where: { id }, data });
  }

  async testPaperless(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organización no encontrada');
    const { paperlessUrl, paperlessToken } = org as any;
    if (!paperlessUrl || !paperlessToken) {
      throw new BadRequestException('Configure URL y token de Paperless-ngx primero');
    }
    try {
      const url = `${(paperlessUrl as string).replace(/\/$/, '')}/api/documents/?page_size=1`;
      const res = await fetch(url, { headers: { Authorization: `Token ${paperlessToken}` } });
      if (!res.ok) {
        return { ok: false, message: `Error ${res.status} al conectar con Paperless-ngx` };
      }
      return { ok: true, message: 'Conexión correcta con Paperless-ngx' };
    } catch (err: any) {
      return { ok: false, message: `No se pudo conectar: ${err.message}` };
    }
  }

  async testSmtp(id: string, toEmail: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organización no encontrada');

    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, name } = org as any;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      throw new BadRequestException('Configuración SMTP incompleta. Rellena host, puerto, usuario y contraseña.');
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: true },
    });

    try {
      await transporter.verify();
      await transporter.sendMail({
        from: `"${name || 'RentCRM Pro'}" <${smtpFrom || smtpUser}>`,
        to: toEmail,
        subject: '✅ Test de email — RentCRM Pro',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
            <div style="text-align:center;margin-bottom:24px;"><span style="font-size:48px;">✅</span></div>
            <h2 style="color:#16a34a;text-align:center;margin-bottom:8px;">Email configurado correctamente</h2>
            <p style="color:#475569;text-align:center;">Tu configuración SMTP en <strong>RentCRM Pro</strong> funciona correctamente.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <table style="width:100%;font-size:13px;color:#64748b;">
              <tr><td style="padding:4px 0;"><strong>Servidor:</strong></td><td>${smtpHost}:${smtpPort}</td></tr>
              <tr><td style="padding:4px 0;"><strong>Usuario:</strong></td><td>${smtpUser}</td></tr>
              <tr><td style="padding:4px 0;"><strong>Remitente:</strong></td><td>${smtpFrom || smtpUser}</td></tr>
            </table>
            <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px;">RentCRM Pro · ${new Date().toLocaleString('es-ES')}</p>
          </div>
        `,
      });
      return { ok: true, message: `Email de prueba enviado a ${toEmail}` };
    } catch (err: any) {
      throw new BadRequestException(`Error SMTP: ${err.message}`);
    }
  }
}
