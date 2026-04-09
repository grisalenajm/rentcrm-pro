import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateFinancialDto } from './dto/create-financial.dto';
import { UpdateFinancialDto } from './dto/update-financial.dto';

@Injectable()
export class FinancialsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    filters?: { propertyId?: string; type?: string; from?: string; to?: string },
    page?: number,
    limit?: number,
  ) {
    const where: any = {
      organizationId,
      ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.from || filters?.to ? {
        date: {
          ...(filters?.from ? { gte: new Date(filters.from) } : {}),
          ...(filters?.to   ? { lte: new Date(filters.to)   } : {}),
        }
      } : {}),
    };
    const include = {
      category: { select: { name: true, type: true } },
      property: { select: { name: true, city: true } },
      booking:  { select: { checkInDate: true, checkOutDate: true } },
    };

    if (!limit) {
      return this.prisma.financial.findMany({ where, include, orderBy: { date: 'desc' } });
    }

    const p = page ?? 1;
    const skip = (p - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.financial.findMany({ where, include, orderBy: { date: 'desc' }, skip, take: limit }),
      this.prisma.financial.count({ where }),
    ]);
    return { data, total, page: p, limit, hasMore: skip + data.length < total };
  }

  async combinedSummary(organizationId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate   = to   ? new Date(to)   : undefined;

    // Ingresos financieros (Financial type=income)
    const financialRecords = await this.prisma.financial.findMany({
      where: {
        organizationId,
        type: 'income',
        ...(fromDate || toDate ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
      },
    });

    // Ingresos de reservas (Booking.totalAmount, status != cancelled, excluye manual_block)
    const bookings = await this.prisma.booking.findMany({
      where: {
        organizationId,
        status: { not: 'cancelled' },
        source: { not: 'manual_block' },
        ...(fromDate || toDate ? { checkInDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
      },
      select: { totalAmount: true, checkInDate: true },
    });

    // Gastos financieros (Financial type=expense)
    const financialExpenses = await this.prisma.financial.findMany({
      where: {
        organizationId,
        type: 'expense',
        ...(fromDate || toDate ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
      },
    });

    // Gastos de la tabla Expense
    const expenses = await this.prisma.expense.findMany({
      where: {
        property: { organizationId },
        ...(fromDate || toDate ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
      },
    });

    // Totales
    const totalIncome  = financialRecords.reduce((s, r) => s + Number(r.amount), 0)
                       + bookings.reduce((s, b) => s + Number(b.totalAmount), 0);
    const totalExpense = financialExpenses.reduce((s, r) => s + Number(r.amount), 0)
                       + expenses.reduce((s, e) => s + Number(e.amount), 0);

    // Desglose mensual
    const months: Record<number, { month: number; ingresos: number; gastos: number }> = {};
    for (let m = 0; m < 12; m++) months[m] = { month: m + 1, ingresos: 0, gastos: 0 };

    for (const r of financialRecords) {
      const m = new Date(r.date).getMonth();
      months[m].ingresos += Number(r.amount);
    }
    for (const b of bookings) {
      const m = new Date(b.checkInDate).getMonth();
      months[m].ingresos += Number(b.totalAmount);
    }
    for (const r of financialExpenses) {
      const m = new Date(r.date).getMonth();
      months[m].gastos += Number(r.amount);
    }
    for (const e of expenses) {
      const m = new Date(e.date).getMonth();
      months[m].gastos += Number(e.amount);
    }

    return {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      profit: Math.round((totalIncome - totalExpense) * 100) / 100,
      monthly: Object.values(months),
    };
  }

  async summary(organizationId: string, from?: string, to?: string) {
    const records = (await this.findAll(organizationId, { from, to })) as any[];
    const income  = records.filter(r => r.type === 'income' ).reduce((s: number, r: any) => s + Number(r.amount), 0);
    const expense = records.filter(r => r.type === 'expense').reduce((s: number, r: any) => s + Number(r.amount), 0);
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
        organizationId,
        status: { not: 'cancelled' },
        source: { not: 'manual_block' },
        checkInDate: { lte: to },
        checkOutDate: { gte: from },
      },
      select: { checkInDate: true, checkOutDate: true, totalAmount: true, source: true },
    });

    // Expense records from Expense model (gastos de propiedad)
    const expenseRecords = await this.prisma.expense.findMany({
      where: {
        propertyId,
        property: { organizationId },
        date: { gte: from, lte: to },
      },
    });

    // Occupancy days clipped to the year — use a Set to avoid double-counting overlapping bookings
    const occupiedDatesSet = new Set<string>();
    for (const b of bookings) {
      const start = b.checkInDate > from ? b.checkInDate : from;
      const end   = b.checkOutDate < to  ? b.checkOutDate : to;
      const cur = new Date(start);
      while (cur < end) {
        occupiedDatesSet.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }
    const occupancyDays = occupiedDatesSet.size;

    // Monthly aggregation
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expenses: 0, profit: 0 }));

    // Financial records (income + expense from Financial model)
    for (const r of records) {
      const m = new Date(r.date).getMonth(); // 0-based
      const amt = Number(r.amount);
      if (r.type === 'income')  { months[m].income   += amt; }
      else                      { months[m].expenses += amt; }
    }

    // Booking income (Booking.totalAmount)
    for (const b of bookings) {
      if (b.totalAmount) {
        const m = new Date(b.checkInDate).getMonth();
        months[m].income += Number(b.totalAmount);
      }
    }

    // Expense model records
    for (const e of expenseRecords) {
      const m = new Date(e.date).getMonth();
      months[m].expenses += Number(e.amount);
    }

    for (const m of months) m.profit = m.income - m.expenses;

    // Totals
    const totalIncomeFinancial = records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
    const totalIncomeBookings  = bookings.reduce((s, b) => s + Number(b.totalAmount || 0), 0);
    const totalIncome  = totalIncomeFinancial + totalIncomeBookings;

    const totalExpenseFinancial = records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    const totalExpenseModel     = expenseRecords.reduce((s, e) => s + Number(e.amount), 0);
    const totalExpense = totalExpenseFinancial + totalExpenseModel;

    // Expenses by category type (Financial expenses + Expense model)
    const byType: Record<string, number> = {};
    for (const r of records.filter(r => r.type === 'expense')) {
      const key = r.category?.name ?? 'otros';
      byType[key] = (byType[key] ?? 0) + Number(r.amount);
    }
    for (const e of expenseRecords) {
      const key = e.type ?? 'otros';
      byType[key] = (byType[key] ?? 0) + Number(e.amount);
    }

    // Deductible total
    const deductibleTotal = records
      .filter(r => r.type === 'expense' && (r as any).deductible)
      .reduce((s, r) => s + Number(r.amount), 0)
      + expenseRecords
        .filter(e => e.deductible)
        .reduce((s, e) => s + Number(e.amount), 0);

    // Income by channel
    const byChannel: Record<string, number> = {};
    for (const r of records.filter(r => r.type === 'income')) {
      const key = r.booking?.source ?? 'directo';
      byChannel[key] = (byChannel[key] ?? 0) + Number(r.amount);
    }
    for (const b of bookings) {
      if (b.totalAmount) {
        const key = b.source ?? 'directo';
        byChannel[key] = (byChannel[key] ?? 0) + Number(b.totalAmount);
      }
    }

    console.log(`[getPropertyReport] propertyId=${propertyId} year=${year} totalIncome=${totalIncome} totalExpense=${totalExpense} bookings=${bookings.length} expenses=${expenseRecords.length}`);

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
