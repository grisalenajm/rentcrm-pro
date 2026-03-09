import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Injectable()
export class EvaluationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEvaluationDto, userId: string) {
    const existing = await this.prisma.clientEvaluation.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existing) throw new ConflictException('Esta reserva ya tiene una evaluación');

    return this.prisma.clientEvaluation.create({
      data: {
        bookingId: dto.bookingId,
        clientId: dto.clientId,
        score: dto.score,
        cleanlinessScore: dto.score,
        behaviourScore: dto.score,
        paymentPunctuality: dto.score,
        notes: dto.notes,
        evaluatedBy: userId,
      },
    });
  }

  async findByClient(clientId: string, organizationId: string) {
    return this.prisma.clientEvaluation.findMany({
      where: {
        clientId,
        booking: { organizationId },
      },
      include: {
        booking: {
          select: {
            checkInDate: true,
            checkOutDate: true,
            totalAmount: true,
            source: true,
            property: { select: { name: true, city: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByBooking(bookingId: string, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, organizationId } });
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    return this.prisma.clientEvaluation.findUnique({
      where: { bookingId },
    });
  }

  async update(id: string, dto: Partial<CreateEvaluationDto>) {
    return this.prisma.clientEvaluation.update({
      where: { id },
      data: {
        ...(dto.score ? { score: dto.score, cleanlinessScore: dto.score, behaviourScore: dto.score, paymentPunctuality: dto.score } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async clientSummary(clientId: string, organizationId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { clientId, organizationId },
      include: {
        evaluation: true,
        property: { select: { name: true, city: true } },
      },
      orderBy: { checkInDate: 'desc' },
    });

    const evaluated = bookings.filter(b => b.evaluation);
    const avgScore = evaluated.length
      ? evaluated.reduce((s, b) => s + b.evaluation!.score, 0) / evaluated.length
      : null;

    return { bookings, avgScore, totalBookings: bookings.length, totalSpent: bookings.reduce((s, b) => s + Number(b.totalAmount), 0) };
  }
}
