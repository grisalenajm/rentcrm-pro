import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, search?: string) {
    return this.prisma.client.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(search ? {
          OR: [
            { firstName:   { contains: search, mode: 'insensitive' } },
            { lastName:    { contains: search, mode: 'insensitive' } },
            { dniPassport: { contains: search, mode: 'insensitive' } },
            { email:       { contains: search, mode: 'insensitive' } },
          ]
        } : {})
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { property: { select: { name: true, city: true } } },
        },
        evaluations: true,
      },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async create(dto: CreateClientDto, organizationId: string, userId: string) {
    const { birthDate, ...rest } = dto;
    return this.prisma.client.create({
      data: {
        ...rest,
        organizationId,
        createdBy: userId,
        ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
      },
    });
  }

  async update(id: string, dto: UpdateClientDto, organizationId: string) {
    await this.findOne(id, organizationId);
    const { birthDate, ...rest } = dto;
    return this.prisma.client.update({
      where: { id },
      data: {
        ...rest,
        ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
      },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
