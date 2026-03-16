import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateFinancialDto } from './dto/create-financial.dto';
import { UpdateFinancialDto } from './dto/update-financial.dto';

@Injectable()
export class FinancialsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, filters?: { propertyId?: string; type?: string; from?: string; to?: string }) {
    return this.prisma.financial.findMany({
      where: {
        organizationId,
        ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.from || filters?.to ? {
          date: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to   ? { lte: new Date(filters.to)   } : {}),
          }
        } : {}),
      },
      include: {
        category: { select: { name: true, type: true } },
        property: { select: { name: true, city: true } },
        booking:  { select: { checkInDate: true, checkOutDate: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async summary(organizationId: string, from?: string, to?: string) {
    const records = await this.findAll(organizationId, { from, to });
    const income  = records.filter(r => r.type === 'income' ).reduce((s, r) => s + Number(r.amount), 0);
    const expense = records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    return { income, expense, profit: income - expense, records: records.length };
  }

  async findCategories(organizationId: string) {
    return this.prisma.financialCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateFinancialDto, organizationId: string, userId: string) {
    return this.prisma.financial.create({
      data: {
        ...dto,
        organizationId,
        createdBy: userId,
        date: new Date(dto.date),
      },
      include: {
        category: { select: { name: true, type: true } },
        property: { select: { name: true, city: true } },
      },
    });
  }

  async update(id: string, dto: UpdateFinancialDto, organizationId: string) {
    const record = await this.prisma.financial.findFirst({ where: { id, organizationId } });
    if (!record) throw new NotFoundException('Registro no encontrado');
    return this.prisma.financial.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.date ? { date: new Date(dto.date) } : {}),
      },
    });
  }

  async remove(id: string, organizationId: string) {
    const record = await this.prisma.financial.findFirst({ where: { id, organizationId } });
    if (!record) throw new NotFoundException('Registro no encontrado');
    return this.prisma.financial.delete({ where: { id } });
  }

  async getPropertyReport(organizationId: string, propertyId: string, year: number) {
    const from = new Date(`${year}-01-01`);
    const to   = new Date(`${year}-12-31`);

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
      select: { id: true, name: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');

    const records = await this.prisma.financial.findMany({
      where: { organizationId, propertyId, date: { gte: from, lte: to } },
      include: {
        category: { select: { name: true } },
        booking:  { select: { source: true } },
      },
    });

    const bookings = await this.prisma.booking.findMany({
      where: {
        propertyId,
        checkInDate: { lte: to },
        checkOutDate: { gte: from },
        status: { not: 'cancelled' },
      },
      select: { checkInDate: true, checkOutDate: true },
    });

    // Occupancy days clipped to the year
    let occupancyDays = 0;
    for (const b of bookings) {
      const start = b.checkInDate > from ? b.checkInDate : from;
      const end   = b.checkOutDate < to  ? b.checkOutDate : to;
      const days  = Math.ceil((end.getTime() - start.getTime()) / 86400000);
      if (days > 0) occupancyDays += days;
    }

    // Monthly aggregation
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expenses: 0, profit: 0 }));
    for (const r of records) {
      const m = new Date(r.date).getMonth(); // 0-based
      const amt = Number(r.amount);
      if (r.type === 'income')  { months[m].income   += amt; }
      else                      { months[m].expenses += amt; }
    }
    for (const m of months) m.profit = m.income - m.expenses;

    // Totals
    const totalIncome  = records.filter(r => r.type === 'income' ).reduce((s, r) => s + Number(r.amount), 0);
    const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);

    // Expenses by category type
    const byType: Record<string, number> = {};
    for (const r of records.filter(r => r.type === 'expense')) {
      const key = r.category?.name ?? 'otros';
      byType[key] = (byType[key] ?? 0) + Number(r.amount);
    }

    // Deductible total
    const deductibleTotal = records
      .filter(r => r.type === 'expense' && (r as any).deductible)
      .reduce((s, r) => s + Number(r.amount), 0);

    // Income by channel (booking source)
    const byChannel: Record<string, number> = {};
    for (const r of records.filter(r => r.type === 'income')) {
      const key = r.booking?.source ?? 'directo';
      byChannel[key] = (byChannel[key] ?? 0) + Number(r.amount);
    }

    return {
      property,
      year,
      months,
      totals: { income: totalIncome, expenses: totalExpense, profit: totalIncome - totalExpense, occupancyDays },
      byType,
      deductibleTotal,
      byChannel,
    };
  }
}
