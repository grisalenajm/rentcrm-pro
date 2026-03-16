import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  findAll(organizationId: string, propertyId?: string, year?: number) {
    const where: any = { property: { organizationId } };
    if (propertyId) where.propertyId = propertyId;
    if (year) {
      where.date = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31T23:59:59`),
      };
    }
    return this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { property: { select: { name: true } } },
    });
  }

  async create(data: { propertyId: string; date: string; amount: number; type: string; notes?: string; deductible?: boolean }, organizationId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: data.propertyId, organizationId },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');
    return this.prisma.expense.create({
      data: {
        propertyId: data.propertyId,
        date: new Date(data.date),
        amount: data.amount,
        type: data.type,
        notes: data.notes,
        deductible: data.deductible ?? false,
      },
    });
  }

  async update(id: number, data: { date?: string; amount?: number; type?: string; notes?: string; deductible?: boolean }, organizationId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, property: { organizationId } },
    });
    if (!expense) throw new NotFoundException('Gasto no encontrado');
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(data.date && { date: new Date(data.date) }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.type && { type: data.type }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.deductible !== undefined && { deductible: data.deductible }),
      },
    });
  }

  async remove(id: number, organizationId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, property: { organizationId } },
    });
    if (!expense) throw new NotFoundException('Gasto no encontrado');
    return this.prisma.expense.delete({ where: { id } });
  }

  async summaryByYear(organizationId: string, propertyId?: string) {
    const expenses = await this.findAll(organizationId, propertyId);
    const summary: Record<number, number> = {};
    for (const e of expenses) {
      const year = new Date(e.date).getFullYear();
      summary[year] = (summary[year] || 0) + e.amount;
    }
    return summary;
  }
}
