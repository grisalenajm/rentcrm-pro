import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { RecountDto } from './dto/recount.dto.js';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  private async computeCurrentStock(propertyId: string, materialId: string): Promise<number> {
    const result = await this.prisma.stockMovement.aggregate({
      where: { propertyId, materialId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  private async getLastEntryPrice(propertyId: string, materialId: string): Promise<number | null> {
    const last = await this.prisma.stockMovement.findFirst({
      where: { propertyId, materialId, type: 'entrada' },
      orderBy: { createdAt: 'desc' },
      select: { unitPrice: true },
    });
    return last?.unitPrice ?? null;
  }

  async getStock(propertyId: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: { propertyId },
      include: { material: true },
      orderBy: { createdAt: 'asc' },
    });

    const materials = await this.prisma.material.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return materials.map((mat) => {
      const matMovements = movements.filter((m) => m.materialId === mat.id);
      const currentStock = matMovements.reduce((sum, m) => sum + m.quantity, 0);

      const lastEntrada = matMovements
        .filter((m) => m.type === 'entrada')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      const lastEntryPrice = lastEntrada?.unitPrice ?? mat.standardPrice;
      const totalValue = currentStock * lastEntryPrice;
      const isAlert = mat.minStock > 0 && currentStock <= mat.minStock;

      return {
        materialId: mat.id,
        currentStock,
        lastEntryPrice,
        totalValue,
        isAlert,
        material: {
          name: mat.name,
          type: mat.type,
          unit: mat.unit,
          barcode: mat.barcode,
          minStock: mat.minStock,
          standardPrice: mat.standardPrice,
          isActive: mat.isActive,
        },
      };
    });
  }

  async getMovements(
    propertyId: string,
    filters: { materialId?: string; type?: string; from?: string; to?: string },
  ) {
    const where: Record<string, any> = { propertyId };
    if (filters.materialId) where.materialId = filters.materialId;
    if (filters.type) where.type = filters.type;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    return this.prisma.stockMovement.findMany({
      where,
      include: {
        material: { select: { name: true, unit: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getValuation(propertyId: string) {
    const stockItems = await this.getStock(propertyId);

    const byTypeMap = new Map<string, { materials: any[]; subtotal: number }>();

    for (const item of stockItems) {
      const type = item.material.type;
      if (!byTypeMap.has(type)) {
        byTypeMap.set(type, { materials: [], subtotal: 0 });
      }
      const group = byTypeMap.get(type)!;
      group.materials.push({
        materialId: item.materialId,
        name: item.material.name,
        unit: item.material.unit,
        currentStock: item.currentStock,
        totalValue: item.totalValue,
        isAlert: item.isAlert,
      });
      group.subtotal += item.totalValue;
    }

    const byType = Array.from(byTypeMap.entries()).map(([type, data]) => ({
      type,
      materials: data.materials,
      subtotal: data.subtotal,
    }));

    const grandTotal = byType.reduce((sum, g) => sum + g.subtotal, 0);
    const alertCount = stockItems.filter((i) => i.isAlert).length;

    return { byType, grandTotal, alertCount };
  }

  async createMovement(dto: CreateStockMovementDto, userId: string) {
    const absQty = Math.abs(dto.quantity);

    // Validate: salidas cannot leave stock negative
    if (dto.type === 'salida') {
      const currentStock = await this.computeCurrentStock(dto.propertyId, dto.materialId);
      if (absQty > currentStock) {
        throw new BadRequestException(
          `Stock insuficiente: stock actual es ${currentStock} unidades`,
        );
      }
    }

    const quantity = dto.type === 'salida' ? -absQty : absQty;

    // Unit price: required for entradas, auto-lookup for salidas
    let unitPrice: number;
    if (dto.type === 'entrada') {
      if (dto.unitPrice === undefined) {
        throw new BadRequestException('unitPrice es requerido para movimientos de tipo entrada');
      }
      unitPrice = dto.unitPrice;
    } else {
      const lastPrice = await this.getLastEntryPrice(dto.propertyId, dto.materialId);
      if (lastPrice !== null) {
        unitPrice = lastPrice;
      } else {
        const mat = await this.prisma.material.findUnique({
          where: { id: dto.materialId },
          select: { standardPrice: true },
        });
        unitPrice = mat?.standardPrice ?? 0;
      }
    }

    return this.prisma.stockMovement.create({
      data: {
        propertyId: dto.propertyId,
        materialId: dto.materialId,
        type: dto.type,
        quantity,
        unitPrice,
        notes: dto.notes,
        userId,
      },
    });
  }

  async recount(propertyId: string, dto: RecountDto, userId: string) {
    const stockItems = await this.getStock(propertyId);
    const stockMap = new Map(stockItems.map((s) => [s.materialId, s]));

    const movements: Array<{
      propertyId: string;
      materialId: string;
      type: string;
      quantity: number;
      unitPrice: number;
      userId: string;
    }> = [];

    for (const item of dto.items) {
      const current = stockMap.get(item.materialId);
      if (!current) continue;

      const ajuste = item.quantity - current.currentStock;
      if (ajuste === 0) continue;

      movements.push({
        propertyId,
        materialId: item.materialId,
        type: 'recuento',
        quantity: ajuste,
        unitPrice: current.lastEntryPrice,
        userId,
      });
    }

    if (movements.length === 0) return { inserted: 0 };

    await this.prisma.$transaction(
      movements.map((m) => this.prisma.stockMovement.create({ data: m })),
    );

    return { inserted: movements.length };
  }
}
