import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  // ── TEMPLATES ──────────────────────────────────────────

  async findAllTemplates(organizationId: string) {
    return this.prisma.contractTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(dto: CreateTemplateDto, organizationId: string) {
    return this.prisma.contractTemplate.create({
      data: { ...dto, organizationId },
    });
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

  // ── CONTRACTS ──────────────────────────────────────────

  async findAll(organizationId: string, bookingId?: string) {
    return this.prisma.contract.findMany({
      where: { organizationId, ...(bookingId ? { bookingId } : {}) },
      include: {
        template: { select: { name: true, type: true } },
        booking:  { include: { client: { select: { firstName: true, lastName: true, email: true } }, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, organizationId },
      include: {
        template: true,
        booking:  { include: { client: true, property: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contrato no encontrado');
    return contract;
  }

  async findByToken(token: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { token },
      include: {
        template: true,
        booking:  { include: { client: true, property: true } },
      },
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
        booking:  { include: { client: { select: { firstName: true, lastName: true, email: true } }, property: { select: { name: true } } } },
      },
    });
  }

  async send(id: string, organizationId: string, baseUrl: string) {
    const contract = await this.findOne(id, organizationId);
    if (contract.status !== 'draft') throw new BadRequestException('Solo se pueden enviar contratos en estado borrador');

    const clientEmail = (contract.booking.client as any).email;
    if (!clientEmail) throw new BadRequestException('El cliente no tiene email registrado');

    const signUrl = `${baseUrl}/sign/${contract.token}`;

    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@rentcrm.com',
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
          <p>El enlace es válido y único para tu reserva.</p>
        `,
      });
    }

    return this.prisma.contract.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date() },
    });
  }

  async sign(token: string, dto: SignContractDto, ip: string) {
    const contract = await this.findByToken(token);

    return this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'signed',
        signatureImage: dto.signatureImage,
        signerName: dto.signerName,
        signerIp: ip,
        signedAt: new Date(),
      },
    });
  }

  async cancel(id: string, organizationId: string) {
    const contract = await this.findOne(id, organizationId);
    if (contract.status === 'signed') throw new BadRequestException('No se puede cancelar un contrato firmado');
    return this.prisma.contract.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  renderContent(content: string, data: Record<string, string>) {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
  }
}
