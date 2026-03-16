import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class RecurringExpensesService {
  private readonly logger = new Logger(RecurringExpensesService.name);

  constructor(private prisma: PrismaService) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  findAll(organizationId: string, propertyId?: string) {
    return this.prisma.recurringExpense.findMany({
      where: {
        organizationId,
        ...(propertyId ? { propertyId } : {}),
      },
      include: { property: { select: { name: true } } },
      orderBy: { nextRunDate: 'asc' },
    });
  }

  async create(data: {
    propertyId: string;
    type: string;
    amount: number;
    deductible?: boolean;
    frequency: string;
    dayOfMonth: number;
    notes?: string;
    nextRunDate: string;
  }, organizationId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: data.propertyId, organizationId },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');

    return this.prisma.recurringExpense.create({
      data: {
        propertyId: data.propertyId,
        organizationId,
        type: data.type,
        amount: data.amount,
        deductible: data.deductible ?? false,
        frequency: data.frequency,
        dayOfMonth: data.dayOfMonth,
        notes: data.notes,
        nextRunDate: new Date(data.nextRunDate),
      },
      include: { property: { select: { name: true } } },
    });
  }

  async update(id: string, data: {
    type?: string;
    amount?: number;
    deductible?: boolean;
    frequency?: string;
    dayOfMonth?: number;
    notes?: string;
    nextRunDate?: string;
    active?: boolean;
  }, organizationId: string) {
    const rec = await this.prisma.recurringExpense.findFirst({
      where: { id, organizationId },
    });
    if (!rec) throw new NotFoundException('Gasto recurrente no encontrado');

    return this.prisma.recurringExpense.update({
      where: { id },
      data: {
        ...(data.type !== undefined      && { type: data.type }),
        ...(data.amount !== undefined    && { amount: data.amount }),
        ...(data.deductible !== undefined && { deductible: data.deductible }),
        ...(data.frequency !== undefined && { frequency: data.frequency }),
        ...(data.dayOfMonth !== undefined && { dayOfMonth: data.dayOfMonth }),
        ...(data.notes !== undefined     && { notes: data.notes }),
        ...(data.nextRunDate             && { nextRunDate: new Date(data.nextRunDate) }),
        ...(data.active !== undefined    && { active: data.active }),
      },
      include: { property: { select: { name: true } } },
    });
  }

  async remove(id: string, organizationId: string) {
    const rec = await this.prisma.recurringExpense.findFirst({
      where: { id, organizationId },
    });
    if (!rec) throw new NotFoundException('Gasto recurrente no encontrado');
    return this.prisma.recurringExpense.delete({ where: { id } });
  }

  // ─── Cron ────────────────────────────────────────────────────────────────────

  @Cron('0 8 * * *')
  async processRecurringExpenses() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const pending = await this.prisma.recurringExpense.findMany({
      where: {
        active: true,
        nextRunDate: { lte: todayEnd },
      },
      include: {
        property: { select: { name: true } },
        organization: true,
      },
    });

    for (const rec of pending) {
      try {
        // a) Crear gasto real
        await this.prisma.expense.create({
          data: {
            propertyId: rec.propertyId,
            date: today,
            amount: rec.amount,
            type: rec.type,
            notes: rec.notes ?? undefined,
            deductible: rec.deductible,
          },
        });

        // b) Actualizar lastRunDate y calcular nextRunDate
        const nextRun = this.calcNextRunDate(today, rec.frequency, rec.dayOfMonth);
        await this.prisma.recurringExpense.update({
          where: { id: rec.id },
          data: { lastRunDate: today, nextRunDate: nextRun },
        });

        // c) Email de notificación
        await this.sendNotification(rec, today);

        // d) Log
        this.logger.log(
          `Gasto recurrente generado: ${rec.type} · ${rec.property.name} · €${rec.amount}`
        );
      } catch (err: any) {
        this.logger.error(`Error procesando gasto recurrente ${rec.id}: ${err.message}`);
      }
    }
  }

  private calcNextRunDate(from: Date, frequency: string, dayOfMonth: number): Date {
    let next = new Date(from);

    if (frequency === 'monthly')   next.setMonth(next.getMonth() + 1);
    else if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
    else if (frequency === 'yearly')    next.setFullYear(next.getFullYear() + 1);

    // Si dayOfMonth > días del mes destino → último día del mes
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(dayOfMonth, maxDay));
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private async sendNotification(rec: any, date: Date) {
    const org = rec.organization;
    if (!org?.smtpHost || !org?.smtpPort || !org?.smtpUser || !org?.smtpPass || !org?.email) return;

    const transporter = nodemailer.createTransport({
      host: org.smtpHost,
      port: Number(org.smtpPort),
      secure: Number(org.smtpPort) === 465,
      auth: { user: org.smtpUser, pass: org.smtpPass },
      tls: { rejectUnauthorized: true },
    });

    const typeLabel: Record<string, string> = {
      tasas: 'Tasas', agua: 'Agua', luz: 'Luz',
      internet: 'Internet', limpieza: 'Limpieza', otros: 'Otros',
    };

    try {
      await transporter.sendMail({
        from: `"${org.name || 'RentCRM Pro'}" <${org.smtpFrom || org.smtpUser}>`,
        to: org.email,
        subject: `Gasto recurrente generado — ${typeLabel[rec.type] ?? rec.type} · ${rec.property.name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
            <h2 style="color:#1e293b;margin-bottom:4px;">Gasto recurrente generado</h2>
            <p style="color:#64748b;margin-top:0;font-size:14px;">Se ha creado automáticamente el siguiente gasto en <strong>RentCRM Pro</strong>.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
            <table style="width:100%;font-size:14px;color:#334155;border-collapse:collapse;">
              <tr><td style="padding:8px 0;font-weight:600;width:140px;">Fecha</td><td>${date.toLocaleDateString('es-ES')}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Propiedad</td><td>${rec.property.name}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Tipo</td><td>${typeLabel[rec.type] ?? rec.type}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Importe</td><td style="color:#dc2626;font-weight:700;">€${Number(rec.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Deducible</td><td>${rec.deductible ? 'Sí' : 'No'}</td></tr>
              ${rec.notes ? `<tr><td style="padding:8px 0;font-weight:600;">Notas</td><td>${rec.notes}</td></tr>` : ''}
            </table>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px;text-align:center;">RentCRM Pro · ${new Date().toLocaleString('es-ES')}</p>
          </div>
        `,
      });
    } catch (err: any) {
      this.logger.warn(`No se pudo enviar email de notificación para gasto recurrente ${rec.id}: ${err.message}`);
    }
  }
}
