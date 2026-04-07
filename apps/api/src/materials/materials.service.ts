import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateBarcode(): Promise<string> {
    const last = await this.prisma.material.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { barcode: true },
    });
    let next = 1;
    if (last?.barcode) {
      const match = last.barcode.match(/^MAT-(\d+)$/);
      if (match) next = parseInt(match[1], 10) + 1;
    }
    return `MAT-${String(next).padStart(8, '0')}`;
  }

  async findAll(type?: string, isActive?: string, search?: string) {
    return this.prisma.material.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Material no encontrado');
    return material;
  }

  async create(dto: CreateMaterialDto) {
    const barcode = await this.generateBarcode();
    return this.prisma.material.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        unit: dto.unit,
        barcode,
        standardPrice: dto.standardPrice,
        minStock: dto.minStock ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateMaterialDto) {
    await this.findOne(id);
    return this.prisma.material.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.standardPrice !== undefined ? { standardPrice: dto.standardPrice } : {}),
        ...(dto.minStock !== undefined ? { minStock: dto.minStock } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.material.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
