import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);
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
    const client = await this.prisma.client.create({
      data: {
        ...rest,
        organizationId,
        createdBy: userId,
        ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
      },
    });
    this.logger.log(JSON.stringify({ event: 'client_modified', action: 'create', clientId: client.id, userId, timestamp: new Date().toISOString() }));
    return client;
  }

  async update(id: string, dto: UpdateClientDto, organizationId: string) {
    await this.findOne(id, organizationId);
    const { birthDate, ...rest } = dto;
    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...rest,
        ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
      },
    });
    this.logger.log(JSON.stringify({ event: 'client_modified', action: 'update', clientId: id, userId: null, timestamp: new Date().toISOString() }));
    return client;
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    const client = await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.logger.log(JSON.stringify({ event: 'client_modified', action: 'delete', clientId: id, userId: null, timestamp: new Date().toISOString() }));
    return client;
  }
}
