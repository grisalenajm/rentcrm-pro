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
}
