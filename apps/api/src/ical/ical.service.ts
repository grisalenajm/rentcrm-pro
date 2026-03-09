import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ICAL = require('ical.js');

@Injectable()
export class ICalService {
  private readonly logger = new Logger(ICalService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.availabilitySync.findMany({
      where: { property: { organizationId } },
      include: { property: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: { propertyId: string; url: string; platform: string }, organizationId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, organizationId },
    });
    if (!property) throw new NotFoundException('Property not found');

    return this.prisma.availabilitySync.create({
      data: {
        propertyId: dto.propertyId,
        platform: dto.platform,
        icalUrl: dto.url,
        exportToken: randomBytes(32).toString('hex'),
        isActive: true,
        lastSyncStatus: 'pending',
      },
    });
  }

  async remove(id: string) {
    const feed = await this.prisma.availabilitySync.findUnique({ where: { id } });
    if (!feed) throw new NotFoundException('Feed not found');
    await this.prisma.availabilitySync.delete({ where: { id } });
    return { ok: true };
  }

  @Cron('0 */6 * * *')
  async syncAll() {
    this.logger.log('iCal auto-sync started');
    const feeds = await this.prisma.availabilitySync.findMany({
      where: { isActive: true, icalUrl: { not: null } },
    });
    for (const feed of feeds) {
      try {
        await this.syncFeed(feed.id);
      } catch (e) {
        this.logger.error(`Error syncing feed ${feed.id}: ${e.message}`);
      }
    }
    this.logger.log('iCal auto-sync finished');
  }

  async syncFeed(id: string) {
    const feed = await this.prisma.availabilitySync.findUnique({ where: { id } });
    if (!feed || !feed.icalUrl) throw new NotFoundException('Feed not found or no URL');

    let icalText: string;
    try {
      const response = await fetch(feed.icalUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      icalText = await response.text();
    } catch (e) {
      await this.prisma.availabilitySync.update({
        where: { id },
        data: { lastSyncStatus: 'error', lastSyncError: e.message },
      });
      throw e;
    }

    const parsed = ICAL.parse(icalText);
    const comp = new ICAL.Component(parsed);
    const vevents = comp.getAllSubcomponents('vevent');

    let imported = 0;
    let skipped = 0;

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      const uid = event.uid;
      const summary = event.summary || 'Reserva importada';
      const dtstart = event.startDate?.toJSDate();
      const dtend = event.endDate?.toJSDate();

      if (!dtstart || !dtend || !uid) { skipped++; continue; }

      const existing = await this.prisma.availabilityBlock.findUnique({
        where: { propertyId_externalUid: { propertyId: feed.propertyId, externalUid: uid } },
      });

      if (existing) { skipped++; continue; }

      await this.prisma.availabilityBlock.create({
        data: {
          propertyId: feed.propertyId,
          syncId: feed.id,
          externalUid: uid,
          summary,
          startDate: dtstart,
          endDate: dtend,
          source: feed.platform,
        },
      });

      imported++;
    }

    await this.prisma.availabilitySync.update({
      where: { id },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'success', lastSyncError: null },
    });

    return { imported, skipped, total: vevents.length };
  }

  async exportPropertyICal(propertyId: string, organizationId: string): Promise<string> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });
    if (!property) throw new NotFoundException('Property not found');

    const bookings = await this.prisma.booking.findMany({
      where: { propertyId, status: { not: 'cancelled' } },
      include: { client: { select: { firstName: true, lastName: true } } },
    });

    const cal = new ICAL.Component(['vcalendar', [], []]);
    cal.updatePropertyWithValue('prodid', '-//RentCRM Pro//ES');
    cal.updatePropertyWithValue('version', '2.0');
    cal.updatePropertyWithValue('calscale', 'GREGORIAN');
    cal.updatePropertyWithValue('x-wr-calname', property.name);

    for (const booking of bookings) {
      const vevent = new ICAL.Component('vevent');
      const event = new ICAL.Event(vevent);
      event.uid = booking.id;
      event.summary = `${booking.client.firstName} ${booking.client.lastName}`;
      event.startDate = ICAL.Time.fromJSDate(new Date(booking.checkInDate), true);
      event.endDate = ICAL.Time.fromJSDate(new Date(booking.checkOutDate), true);
      cal.addSubcomponent(vevent);
    }

    return cal.toString();
  }
}
