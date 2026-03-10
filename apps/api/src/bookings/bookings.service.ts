import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateBookingGuestSesDto } from './dto/booking-guest-ses.dto';
import { TranslationService } from '../translation/translation.service';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private translationService: TranslationService,
  ) {}

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
        guestsSes: true,
      },
      orderBy: { checkInDate: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, organizationId },
      include: {
        client:        { select: { id: true, firstName: true, lastName: true, dniPassport: true, nationality: true, birthDate: true, language: true } },
        property:      { select: { id: true, name: true, city: true, address: true } },
        guests:        { include: { client: true } },
        guestsSes:     true,
        policeReports: true,
        evaluation:    true,
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
        guestsSes: true,
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

  // ── Huéspedes SES ─────────────────────────────────────────────────────────
  async getGuestsSes(bookingId: string, organizationId: string) {
    await this.findOne(bookingId, organizationId);
    return this.prisma.bookingGuestSes.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addGuestSes(bookingId: string, dto: CreateBookingGuestSesDto, organizationId: string) {
    await this.findOne(bookingId, organizationId);
    return this.prisma.bookingGuestSes.create({
      data: {
        bookingId,
        firstName:  dto.firstName,
        lastName:   dto.lastName,
        docType:    dto.docType,
        docNumber:  dto.docNumber,
        docCountry: dto.docCountry,
        birthDate:  dto.birthDate ? new Date(dto.birthDate) : undefined,
        phone:      dto.phone,
      },
    });
  }

  async removeGuestSes(bookingId: string, guestId: string, organizationId: string) {
    await this.findOne(bookingId, organizationId);
    return this.prisma.bookingGuestSes.delete({
      where: { id: guestId },
    });
  }

  // ── Checkin Online ─────────────────────────────────────────────────────────
  private async sendEmail(organizationId: string, opts: { to: string; subject: string; html: string }) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org?.smtpHost || !org?.smtpPort || !org?.smtpUser || !org?.smtpPass) {
      throw new BadRequestException('Configuración SMTP incompleta en la organización');
    }
    const transporter = nodemailer.createTransport({
      host: org.smtpHost,
      port: Number(org.smtpPort),
      secure: Number(org.smtpPort) === 465,
      auth: { user: org.smtpUser, pass: org.smtpPass },
    });
    await transporter.sendMail({
      from: org.smtpFrom || org.smtpUser,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  }

  async sendCheckinLink(bookingId: string, organizationId: string, language?: string): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, organizationId },
      include: { client: true, property: true },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    if (!booking.client?.email) throw new BadRequestException('El cliente no tiene email');

    const token = randomUUID();
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        checkinToken: token,
        checkinStatus: 'pending',
        checkinSentAt: new Date(),
      },
    });

    const lang = language || (booking.client as any).language || 'es';
    const checkinUrl = `${process.env.FRONTEND_URL}/checkin/${token}`;
    const propertyName = booking.property.name;

    const [
      greeting,
      bodyText,
      buttonText,
      footerText,
    ] = await this.translationService.translateMany([
      `¡Hola ${booking.client.firstName}!`,
      `Tu reserva en ${propertyName} comienza el ${new Date(booking.checkInDate).toLocaleDateString('es-ES')}. Por favor completa tu checkin online antes de tu llegada:`,
      'Completar checkin',
      'Este enlace es personal e intransferible.',
    ], lang);

    const subject = `Checkin online — ${propertyName}`;
    const finalBodyText = bodyText.replace(new RegExp(propertyName, 'gi'), propertyName);

    await this.sendEmail(organizationId, {
      to: booking.client.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${greeting}</h2>
          <p>${finalBodyText}</p>
          <a href="${checkinUrl}"
             style="display:inline-block; background:#10b981; color:white; padding:12px 24px;
                    border-radius:8px; text-decoration:none; font-weight:bold; margin:16px 0;">
            ${buttonText}
          </a>
          <p style="color:#666; font-size:14px;">URL: ${checkinUrl}</p>
          <p style="color:#666; font-size:14px;">${footerText}</p>
        </div>
      `,
    });
  }

  async getCheckinByToken(token: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { checkinToken: token },
      include: {
        property: { select: { name: true, address: true, city: true } },
        client:   { select: { firstName: true, lastName: true, email: true, language: true } },
      },
    });
    if (!booking) throw new NotFoundException('Enlace no válido');
    if (booking.checkinStatus === 'completed') {
      throw new BadRequestException('Este checkin ya fue completado');
    }

    const lang = (booking.client as any)?.language || 'es';

    const [
      titleText,
      subtitleText,
      labelFirstName,
      labelLastName,
      labelDocType,
      labelDocNumber,
      labelDocCountry,
      labelPhone,
      buttonText,
      successTitle,
      successMessage,
      errorInvalid,
      errorCompleted,
      requiredFieldsError,
      labelCheckin,
      labelCheckout,
      docTypeDni,
      docTypePassport,
      docTypeNie,
      docTypeOther,
      countryES,
      countryGB,
      countryFR,
      countryDE,
      countryIT,
      countryPT,
      countryUS,
      countryOther,
      sectionTitle,
      sendingText,
      countryDK,
      countryNO,
      countrySE,
      countryNL,
      countryBE,
      countryCH,
      countryAT,
      countryPL,
      countryCZ,
      countryHU,
      countryRO,
      countryBG,
      countryGR,
      countryHR,
      countryMX,
      countryAR,
      countryCO,
      countryBR,
      countryCN,
      countryJP,
      countryAU,
      countryCA,
      countryRU,
      countryMA,
      countryDZ,
      countryTR,
      countryIL,
      countryAE,
      guestsTitle,
      guestsNotice,
      addGuestButton,
      guestLabel,
      labelBirthDate,
    ] = await this.translationService.translateMany([
      'Checkin online',
      'Por favor completa tus datos antes de tu llegada',
      'Nombre',
      'Apellidos',
      'Tipo de documento',
      'Número de documento',
      'País del documento',
      'Teléfono (opcional)',
      'Completar checkin',
      '¡Checkin completado!',
      'Tus datos han sido registrados. ¡Que disfrutes tu estancia!',
      'Enlace no válido o expirado',
      'Este checkin ya fue completado',
      'Por favor completa todos los campos obligatorios',
      'Entrada',
      'Salida',
      'DNI',
      'Pasaporte',
      'NIE',
      'Otro',
      'España',
      'Reino Unido',
      'Francia',
      'Alemania',
      'Italia',
      'Portugal',
      'Estados Unidos',
      'Otro',
      'Tus datos',
      'Enviando...',
      'Dinamarca',
      'Noruega',
      'Suecia',
      'Países Bajos',
      'Bélgica',
      'Suiza',
      'Austria',
      'Polonia',
      'República Checa',
      'Hungría',
      'Rumanía',
      'Bulgaria',
      'Grecia',
      'Croacia',
      'México',
      'Argentina',
      'Colombia',
      'Brasil',
      'China',
      'Japón',
      'Australia',
      'Canadá',
      'Rusia',
      'Marruecos',
      'Argelia',
      'Turquía',
      'Israel',
      'Emiratos Árabes Unidos',
      'Otros huéspedes (mayores de 14 años)',
      'Es obligatorio registrar todos los huéspedes mayores de 14 años según la normativa de hospedaje.',
      'Añadir huésped',
      'Huésped',
      'Fecha de nacimiento',
    ], lang);

    return {
      propertyName:    booking.property.name,
      propertyCity:    booking.property.city,
      startDate:       booking.checkInDate,
      endDate:         booking.checkOutDate,
      clientFirstName: booking.client?.firstName,
      clientLastName:  booking.client?.lastName,
      clientEmail:     booking.client?.email,
      language:        lang,
      ui: {
        titleText,
        subtitleText,
        labelFirstName,
        labelLastName,
        labelDocType,
        labelDocNumber,
        labelDocCountry,
        labelPhone,
        buttonText,
        successTitle,
        successMessage,
        errorInvalid,
        errorCompleted,
        requiredFieldsError,
        labelCheckin,
        labelCheckout,
        docTypeDni,
        docTypePassport,
        docTypeNie,
        docTypeOther,
        countryES,
        countryGB,
        countryFR,
        countryDE,
        countryIT,
        countryPT,
        countryUS,
        countryOther,
        sectionTitle,
        sendingText,
        countryDK,
        countryNO,
        countrySE,
        countryNL,
        countryBE,
        countryCH,
        countryAT,
        countryPL,
        countryCZ,
        countryHU,
        countryRO,
        countryBG,
        countryGR,
        countryHR,
        countryMX,
        countryAR,
        countryCO,
        countryBR,
        countryCN,
        countryJP,
        countryAU,
        countryCA,
        countryRU,
        countryMA,
        countryDZ,
        countryTR,
        countryIL,
        countryAE,
        guestsTitle,
        guestsNotice,
        addGuestButton,
        guestLabel,
        labelBirthDate,
      },
    };
  }

  async completeCheckin(token: string, data: {
    firstName: string;
    lastName: string;
    docType: string;
    docNumber: string;
    docCountry: string;
    phone?: string;
    guests?: Array<{ firstName: string; lastName: string; docType: string; docNumber: string; docCountry: string; birthDate?: string }>;
  }) {
    const booking = await this.prisma.booking.findUnique({
      where: { checkinToken: token },
      include: { client: true },
    });
    if (!booking) throw new NotFoundException('Enlace no válido');
    if (booking.checkinStatus === 'completed') {
      throw new BadRequestException('Este checkin ya fue completado');
    }

    if (booking.clientId) {
      await this.prisma.client.update({
        where: { id: booking.clientId },
        data: {
          firstName:  data.firstName,
          lastName:   data.lastName,
          dniPassport: data.docNumber,
          ...(data.phone && { phone: data.phone }),
        },
      });
    }

    await this.prisma.booking.update({
      where: { checkinToken: token },
      data: {
        checkinStatus: 'completed',
        checkinDoneAt: new Date(),
      },
    });

    if (data.guests && data.guests.length > 0) {
      await this.prisma.bookingGuestSes.createMany({
        data: data.guests.map((g: any) => ({
          bookingId: booking.id,
          firstName: g.firstName,
          lastName: g.lastName,
          docType: g.docType,
          docNumber: g.docNumber,
          docCountry: g.docCountry,
          birthDate: g.birthDate ? new Date(g.birthDate) : null,
        }))
      });
    }

    return { ok: true, message: '¡Checkin completado con éxito!' };
  }

  @Cron('0 9 * * *')
  async sendCheckinReminders(): Promise<void> {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const startOfDay = new Date(twoDaysFromNow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(twoDaysFromNow);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        checkInDate: { gte: startOfDay, lte: endOfDay },
        checkinStatus: null,
        client: { email: { not: null } },
      },
      include: { property: true },
    });

    for (const booking of bookings) {
      await this.sendCheckinLink(booking.id, booking.property.organizationId).catch(e =>
        console.log(JSON.stringify({ event: 'checkin_reminder_error', bookingId: booking.id, error: e.message }))
      );
    }
  }
}
