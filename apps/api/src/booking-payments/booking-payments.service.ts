import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBookingPaymentDto } from './dto/create-booking-payment.dto';

@Injectable()
export class BookingPaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(bookingId: string, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, organizationId },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    return this.prisma.bookingPayment.findMany({
      where: { bookingId },
      orderBy: { date: 'asc' },
    });
  }

  async create(bookingId: string, dto: CreateBookingPaymentDto, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, organizationId },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    return this.prisma.bookingPayment.create({
      data: {
        bookingId,
        concept: dto.concept,
        amount: dto.amount,
        date: new Date(dto.date),
        notes: dto.notes,
      },
    });
  }

  async remove(id: string, bookingId: string, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, organizationId },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const payment = await this.prisma.bookingPayment.findFirst({
      where: { id, bookingId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    return this.prisma.bookingPayment.delete({ where: { id } });
  }
}
