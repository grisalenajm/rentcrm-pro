import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, propertyId?: string) {
    return this.prisma.booking.findMany({
      where: {
        organizationId,
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        client:   { select: { id: true, firstName: true, lastName: true, dniPassport: true } },
        property: { select: { id: true, name: true, city: true } },
        guests:   { include: { client: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { checkInDate: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, organizationId },
      include: {
        client:       { select: { id: true, firstName: true, lastName: true, dniPassport: true, nationality: true, birthDate: true } },
        property:     { select: { id: true, name: true, city: true, address: true } },
        guests:       { include: { client: true } },
        policeReports:true,
        evaluation:   true,
      },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    return booking;
  }

  async checkAvailability(propertyId: string, checkIn: string, checkOut: string, excludeBookingId?: string) {
    const conflict = await this.prisma.booking.findFirst({
      where: {
        propertyId,
        status: { notIn: ['cancelled'] },
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        AND: [
          { checkInDate:  { lt: new Date(checkOut) } },
          { checkOutDate: { gt: new Date(checkIn)  } },
        ],
      },
    });
    return !conflict;
  }

  async create(dto: CreateBookingDto, organizationId: string, userId: string) {
    const available = await this.checkAvailability(dto.propertyId, dto.checkInDate, dto.checkOutDate);
    if (!available) throw new BadRequestException('La propiedad no está disponible en esas fechas');

    const { guests, ...bookingData } = dto;

    return this.prisma.booking.create({
      data: {
        ...bookingData,
        organizationId,
        createdBy: userId,
        checkInDate:  new Date(dto.checkInDate),
        checkOutDate: new Date(dto.checkOutDate),
        guests: guests?.length ? {
          create: guests.map(g => ({ clientId: g.clientId, role: g.role || 'guest' }))
        } : undefined,
      },
      include: {
        client:   { select: { id: true, firstName: true, lastName: true } },
        property: { select: { id: true, name: true, city: true } },
        guests:   { include: { client: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
  }

  async update(id: string, dto: UpdateBookingDto, organizationId: string) {
    await this.findOne(id, organizationId);
    const { guests, ...bookingData } = dto;

    if (bookingData.checkInDate || bookingData.checkOutDate) {
      const current = await this.prisma.booking.findUnique({ where: { id } });
      const checkIn  = bookingData.checkInDate  || current!.checkInDate.toISOString();
      const checkOut = bookingData.checkOutDate || current!.checkOutDate.toISOString();
      const available = await this.checkAvailability(current!.propertyId, checkIn, checkOut, id);
      if (!available) throw new BadRequestException('La propiedad no está disponible en esas fechas');
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        ...bookingData,
        ...(bookingData.checkInDate  ? { checkInDate:  new Date(bookingData.checkInDate)  } : {}),
        ...(bookingData.checkOutDate ? { checkOutDate: new Date(bookingData.checkOutDate) } : {}),
      },
    });
  }

  async cancel(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.booking.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }
}
