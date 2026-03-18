import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.property.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');
    return property;
  }

  async create(dto: CreatePropertyDto, organizationId: string, userId: string) {
    return this.prisma.property.create({
      data: { ...dto, organizationId, createdBy: userId },
    });
  }

  async update(id: string, dto: UpdatePropertyDto, organizationId: string) {
    await this.findOne(id, organizationId);
    try {
      return await this.prisma.property.update({
        where: { id },
        data: dto,
      });
    } catch (e: any) {
      if (e?.code === 'P2000') throw new BadRequestException('El valor introducido es demasiado largo para el campo');
      throw e;
    }
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.property.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
