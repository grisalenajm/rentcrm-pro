import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateBookingGuestSesDto } from './dto/booking-guest-ses.dto';
import { TranslationService } from '../translation/translation.service';
import { PropertyContentService } from '../property-content/property-content.service';
import { PropertyRulesService } from '../property-rules/property-rules.service';
import { renderEmailTemplate } from '../translation/ui-translations';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  constructor(
    private prisma: PrismaService,
    private translationService: TranslationService,
    private propertyContentService: PropertyContentService,
    private propertyRulesService: PropertyRulesService,
  ) {}

  async findAll(organizationId: string, propertyId?: string, clientId?: string) {
    return this.prisma.booking.findMany({
      where: {
        organizationId,
        ...(propertyId ? { propertyId } : {}),
        ...(clientId ? { clientId } : {}),
      },
      include: {
        client:     { select: { id: true, firstName: true, lastName: true, dniPassport: true } },
        property:   { select: { id: true, name: true, city: true } },
        guests:     { include: { client: { select: { id: true, firstName: true, lastName: true } } } },
        guestsSes:  true,
        evaluation: true,
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
    const { guests, startDate, endDate, totalPrice, notes, checkInDate, checkOutDate, ...rest } = dto as any;

    const resolvedCheckIn  = startDate  || checkInDate;
    const resolvedCheckOut = endDate    || checkOutDate;

    if (resolvedCheckIn || resolvedCheckOut) {
      const current = await this.prisma.booking.findUnique({ where: { id } });
      const checkIn  = resolvedCheckIn  || current!.checkInDate.toISOString();
      const checkOut = resolvedCheckOut || current!.checkOutDate.toISOString();
      const available = await this.checkAvailability(current!.propertyId, checkIn, checkOut, id);
      if (!available) throw new BadRequestException('La propiedad no está disponible en esas fechas');
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        ...rest,
        ...(resolvedCheckIn  ? { checkInDate:  new Date(resolvedCheckIn)  } : {}),
        ...(resolvedCheckOut ? { checkOutDate: new Date(resolvedCheckOut) } : {}),
        ...(totalPrice !== undefined ? { totalAmount: parseFloat(String(totalPrice)) } : {}),
        ...(notes !== undefined ? { notes } : {}),
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

  async updateStatus(id: string, newStatus: string, organizationId: string) {
    const booking = await this.findOne(id, organizationId);
    const transitions: Record<string, string[]> = {
      created:    ['registered', 'cancelled'],
      registered: ['processed', 'error', 'cancelled'],
      processed:  [],
      error:      ['registered', 'processed', 'cancelled'],
      cancelled:  [],
    };
    const allowed = transitions[booking.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Transición no válida: ${booking.status} → ${newStatus}`);
    }
    return this.prisma.booking.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  async updateStatusOnCheckinComplete(bookingId: string, organizationId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId } });
    if (!booking) return;
    if (booking.status === 'created' || booking.status === 'error') {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'registered' },
      });
    }
  }

  async updateStatusOnSesSent(bookingId: string, organizationId: string, success: boolean) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId } });
    if (!booking) return;
    if (success && (booking.status === 'registered' || booking.status === 'error')) {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'processed' },
      });
    } else if (!success) {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'error' },
      });
    }
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

  async sendSesErrorEmail(
    bookingId: string,
    organizationId: string,
    recipientEmail: string,
    errorMessage: string,
    lote?: string | null,
  ): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, organizationId },
      include: { property: true },
    });
    if (!booking) return;

    const property = booking.property as any;
    const checkIn  = new Date(booking.checkInDate).toLocaleDateString('es-ES');
    const checkOut = new Date(booking.checkOutDate).toLocaleDateString('es-ES');
    const policeUrl = `${process.env.FRONTEND_URL}/police`;

    const subject = `❌ Error en parte SES — ${property.name} ${checkIn}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: #ef4444; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; margin: 0;">❌ Error en el envío del parte SES</h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: none;
                    border-radius: 0 0 8px 8px; padding: 24px;">

          <h3 style="color: #475569; margin-top: 0;">Datos de la reserva</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; width: 140px;">Propiedad</td>
              <td style="padding: 8px 0; font-weight: bold;">${property.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Check-in</td>
              <td style="padding: 8px 0;">${checkIn}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Check-out</td>
              <td style="padding: 8px 0;">${checkOut}</td>
            </tr>
            ${lote ? `<tr>
              <td style="padding: 8px 0; color: #64748b;">Nº Lote SES</td>
              <td style="padding: 8px 0; font-family: monospace;">${lote}</td>
            </tr>` : ''}
          </table>

          <h3 style="color: #475569;">Error recibido del Ministerio</h3>
          <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px;
                      padding: 12px 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #b91c1c;">${errorMessage}</p>
          </div>

          <a href="${policeUrl}"
             style="display: inline-block; background: #10b981; color: white; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">
            Gestionar reenvío en Partes SES →
          </a>

          <p style="color: #94a3b8; font-size: 13px; margin: 0;">
            RentCRM Pro · ${new Date().toLocaleString('es-ES')}
          </p>
        </div>
      </div>
    `;

    await this.sendEmail(organizationId, { to: recipientEmail, subject, html });
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
    const date = new Date(booking.checkInDate).toLocaleDateString('es-ES');

    // Use pre-translated templates — no LibreTranslate call needed
    const greeting  = renderEmailTemplate('checkinGreeting', lang, { name: booking.client.firstName });
    const finalBodyText = renderEmailTemplate('checkinBody', lang, { property: propertyName, date });
    const [buttonText, footerText] = await this.translationService.translateMany([
      'Completar checkin',
      'Este enlace es personal e intransferible.',
    ], lang);

    const subject = `Checkin online — ${propertyName}`;

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
        client:   { select: { firstName: true, lastName: true, language: true, street: true, city: true, postalCode: true, province: true, country: true } },
      },
    });
    if (!booking) throw new NotFoundException('Enlace no válido');
    if (booking.checkinStatus === 'completed') {
      throw new BadRequestException('Este checkin ya fue completado');
    }

    const lang = (booking.client as any)?.language || 'es';

    const houseRules = await this.propertyRulesService.getRulesForCheckin(booking.propertyId, lang);

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
      labelAddress,
      labelStreet,
      labelCity,
      labelPostalCode,
      labelProvince,
      labelCountryRes,
      labelSameAddress,
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
      'Dirección',
      'Calle y número',
      'Ciudad',
      'Código postal',
      'Provincia',
      'País de residencia',
      'Misma dirección que el titular',
    ], lang);

    return {
      propertyName:    booking.property.name,
      propertyCity:    booking.property.city,
      startDate:       booking.checkInDate,
      endDate:         booking.checkOutDate,
      clientFirstName: booking.client?.firstName,
      clientLastName:  booking.client?.lastName,
      clientStreet:    (booking.client as any)?.street,
      clientCity:      (booking.client as any)?.city,
      clientPostalCode:(booking.client as any)?.postalCode,
      clientProvince:  (booking.client as any)?.province,
      clientCountry:   (booking.client as any)?.country,
      language:        lang,
      houseRules,
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
        labelAddress,
        labelStreet,
        labelCity,
        labelPostalCode,
        labelProvince,
        labelCountryRes,
        labelSameAddress,
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
    street?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
    guests?: Array<{ firstName: string; lastName: string; docType: string; docNumber: string; docCountry: string; birthDate?: string; street?: string; city?: string; postalCode?: string; province?: string; country?: string }>;
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
          ...(data.phone      && { phone:      data.phone }),
          ...(data.street     && { street:     data.street }),
          ...(data.city       && { city:       data.city }),
          ...(data.postalCode && { postalCode: data.postalCode }),
          ...(data.province   && { province:   data.province }),
          ...(data.country    && { country:    data.country }),
        },
      });
    }

    await this.prisma.booking.update({
      where: { checkinToken: token },
      data: {
        checkinStatus: 'completed',
        checkinDoneAt: new Date(),
        checkinToken: null,
      },
    });

    if (booking.status === 'created' || booking.status === 'error') {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'registered' },
      });
    }

    if (data.guests && data.guests.length > 0) {
      await this.prisma.bookingGuestSes.createMany({
        data: data.guests.map((g: any) => ({
          bookingId:  booking.id,
          firstName:  g.firstName,
          lastName:   g.lastName,
          docType:    g.docType,
          docNumber:  g.docNumber,
          docCountry: g.docCountry,
          birthDate:  g.birthDate ? new Date(g.birthDate) : null,
          street:     g.street     || null,
          city:       g.city       || null,
          postalCode: g.postalCode || null,
          province:   g.province   || null,
          country:    g.country    || null,
        }))
      });
    }

    return { ok: true, message: '¡Checkin completado con éxito!' };
  }

  async sendWelcomePackage(bookingId: string, organizationId: string): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, organizationId },
      include: {
        client:   { select: { firstName: true, email: true, language: true } },
        property: { select: { id: true, name: true } },
      },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    if (!booking.client?.email) throw new BadRequestException('El cliente no tiene email');

    const lang = booking.client.language || 'es';
    const guestName    = `${booking.client.firstName}`;
    const propertyName = booking.property.name;
    const checkIn      = new Date(booking.checkInDate).toLocaleDateString('es-ES');

    const content = await this.propertyContentService.getContent(organizationId, booking.property.id);
    const docs    = await this.propertyContentService.getDocumentsWithData(organizationId, booking.property.id);

    // Translate subject using static cache — no LibreTranslate call needed
    const [stayAt, arrivalInfo] = await this.translationService.translateMany(
      ['Tu estancia en', 'Información de llegada'],
      lang,
    );
    const subject = `${stayAt} ${propertyName} — ${arrivalInfo}`;

    // Determine which PropertyContent record owns the active template
    const rawTemplate = content.template || '';
    const ownerRecord = content._specific?.template ? content._specific : content._global;

    // Translate template BEFORE variable substitution so the result is cacheable per property+language
    let translatedTemplate = rawTemplate;
    if (rawTemplate && lang !== 'es') {
      const cached = this.propertyContentService.getCachedTemplateTranslation(ownerRecord, lang);
      if (cached !== null) {
        translatedTemplate = cached;
      } else {
        const [translated] = await this.translationService.translateMany([rawTemplate], lang);
        translatedTemplate = translated || rawTemplate;
        if (ownerRecord?.id) {
          await this.propertyContentService.cacheTemplateTranslation(ownerRecord.id, lang, translatedTemplate);
        }
      }
    }

    // Substitute variables after translation
    let bodyHtml = translatedTemplate
      .replace(/\{\{guest_name\}\}/g, guestName)
      .replace(/\{\{property_name\}\}/g, propertyName);

    // Wrap in email shell
    const html = `
      <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; background: #0f172a; color: #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #10b981; padding: 20px 28px;">
          <h1 style="color: white; margin: 0; font-size: 20px;">🏠 ${propertyName}</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0; font-size: 14px;">${checkIn}</p>
        </div>
        <div style="padding: 28px; line-height: 1.7; color: #e2e8f0;">
          ${bodyHtml || `<p style="color:#94a3b8;">Bienvenido/a a ${propertyName}. ¡Que disfrutes tu estancia!</p>`}
          ${docs.length > 0 ? `
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155;">
              <p style="color: #94a3b8; font-size: 14px; margin: 0;">📎 ${docs.length} documento${docs.length > 1 ? 's' : ''} adjunto${docs.length > 1 ? 's' : ''}</p>
            </div>
          ` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px;">
            RentCRM Pro
          </p>
        </div>
      </div>
    `;

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

    const attachments = docs.map(doc => ({
      filename: doc.name.endsWith('.pdf') ? doc.name : `${doc.name}.pdf`,
      content: Buffer.from(doc.fileData, 'base64'),
      contentType: 'application/pdf',
    }));

    await transporter.sendMail({
      from: org.smtpFrom || org.smtpUser,
      to: booking.client.email,
      subject,
      html,
      attachments,
    });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { welcomeSentAt: new Date() },
    });
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
        this.logger.error(JSON.stringify({ event: 'checkin_reminder_error', bookingId: booking.id, error: e.message }))
      );
    }

    // También enviar el welcome package a reservas que aún no lo hayan recibido
    const welcomeBookings = await this.prisma.booking.findMany({
      where: {
        checkInDate: { gte: startOfDay, lte: endOfDay },
        welcomeSentAt: null,
        client: { email: { not: null } },
        status: { notIn: ['cancelled'] },
      },
      include: { property: true },
    });

    for (const booking of welcomeBookings) {
      await this.sendWelcomePackage(booking.id, booking.property.organizationId).catch(e =>
        this.logger.error(JSON.stringify({ event: 'welcome_reminder_error', bookingId: booking.id, error: e.message }))
      );
    }
  }
}
