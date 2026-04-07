import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { getPublicBaseUrl } from '../common/public-url.helper';
import { LogsService } from '../logs/logs.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ICAL = require('ical.js');

@Injectable()
export class ICalService {
  private readonly logger = new Logger(ICalService.name);

  constructor(private prisma: PrismaService, private logsService: LogsService) {}

  private async validateExternalUrl(url: string): Promise<void> {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Protocolo no permitido');
    }
    const { address } = await lookup(parsed.hostname);
    const privateRanges = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./];
    if (privateRanges.some(r => r.test(address))) {
      throw new BadRequestException('URL no permitida');
    }
  }

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

  async remove(id: string, organizationId: string) {
    const feed = await this.prisma.availabilitySync.findFirst({
      where: { id, property: { organizationId } },
    });
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
    const feed = await this.prisma.availabilitySync.findUnique({
      where: { id },
      include: { property: { select: { id: true, name: true, organizationId: true } } },
    });
    if (!feed || !feed.icalUrl) throw new NotFoundException('Feed not found or no URL');

    await this.validateExternalUrl(feed.icalUrl);

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
      await this.logsService.add('error', 'iCal', `Error al descargar feed ${feed.platform} (${feed.property?.name})`, { feedId: id, error: e.message });
      throw e;
    }

    const parsed = ICAL.parse(icalText);
    const comp = new ICAL.Component(parsed);
    const vevents = comp.getAllSubcomponents('vevent');

    // Collect all UIDs present in this feed snapshot (for cleanup later)
    const feedUids = new Set<string>();
    for (const vevent of vevents) {
      const uid = new ICAL.Event(vevent).uid;
      if (uid) feedUids.add(uid);
    }

    let imported = 0;
    let skipped  = 0;

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      const uid = event.uid;
      const summary = event.summary || 'Reserva importada';
      const dtstart = event.startDate?.toJSDate();
      const dtend = event.endDate?.toJSDate();

      if (!dtstart || !dtend || !uid) {
        this.logger.warn(`iCal skip: uid=${uid} dtstart=${dtstart} dtend=${dtend} summary="${summary}"`);
        skipped++; continue;
      }

      const existing = await this.prisma.availabilityBlock.findUnique({
        where: { propertyId_externalUid: { propertyId: feed.propertyId, externalUid: uid } },
      });

      if (existing) {
        this.logger.log(`iCal skip duplicate: uid=${uid} summary="${summary}"`);
        skipped++; continue;
      }

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

      // Auto-create Booking for Airbnb / Booking.com imports
      const BLOCK_KEYWORDS = ['closed', 'not available', 'blocked', 'unavailable'];
      const isBlock = (s?: string) => BLOCK_KEYWORDS.some(k => s?.toLowerCase().includes(k));

      const platform = feed.platform?.toLowerCase() ?? '';
      const platformSource =
        platform === 'airbnb' ? 'airbnb' :
        platform === 'booking' ? 'booking' : null;

      // If platform is known (airbnb/booking), always use it — their iCal events
      // use "Not available" / "CLOSED" summaries even for real reservations.
      // Only fall back to manual_block for unknown/generic feeds.
      const bookingSource = platformSource ?? (isBlock(summary) ? 'manual_block' : null);

      if (bookingSource) {
        const existingBooking = await this.prisma.booking.findFirst({
          where: { externalId: uid },
        });

        if (!existingBooking) {
          await this.prisma.booking.create({
            data: {
              propertyId: feed.propertyId,
              organizationId: (feed as any).property.organizationId,
              checkInDate: dtstart,
              checkOutDate: dtend,
              status: 'created',
              source: bookingSource,
              externalId: uid,
              clientId: null,
              totalAmount: null,
              checkinToken: randomUUID(),
              checkinStatus: 'pending',
              notes: bookingSource === 'airbnb' ? 'Airbnb' : bookingSource === 'booking' ? 'Booking.com' : summary,
            },
          });
          this.logger.log(`iCal auto-booking created: uid=${uid} source=${bookingSource}`);
          await this.logsService.add('info', 'iCal', `Reserva importada desde ${bookingSource} — ${feed.property?.name}`, {
            uid, source: bookingSource, checkIn: dtstart, checkOut: dtend, summary,
          });
        }
      }

      imported++;
    }

    // Cleanup: remove AvailabilityBlocks (and their manual_block Bookings) that no
    // longer appear in the current feed snapshot for this syncId.
    const staleBlocks = await this.prisma.availabilityBlock.findMany({
      where: {
        syncId: feed.id,
        ...(feedUids.size > 0 ? { externalUid: { notIn: Array.from(feedUids) } } : {}),
      },
    });
    let removed = 0;
    for (const block of staleBlocks) {
      await this.prisma.booking.deleteMany({
        where: { externalId: block.externalUid, source: 'manual_block' },
      });
      await this.prisma.availabilityBlock.delete({ where: { id: block.id } });
      removed++;
    }
    if (removed > 0) {
      this.logger.log(`iCal cleanup: removed ${removed} stale blocks for feed ${id}`);
      await this.logsService.add('info', 'iCal', `Limpieza ${feed.platform} — ${feed.property?.name}: ${removed} bloqueos obsoletos eliminados`, {
        feedId: id, removed,
      });
    }

    await this.prisma.availabilitySync.update({
      where: { id },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'success', lastSyncError: null },
    });

    await this.logsService.add('info', 'iCal', `Sync ${feed.platform} — ${feed.property?.name}: ${imported} importadas, ${skipped} omitidas`, {
      feedId: id, platform: feed.platform, property: feed.property?.name, imported, skipped, removed, total: vevents.length,
    });

    return { imported, skipped, removed, total: vevents.length };
  }

  async getExportUrl(propertyId: string, organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findFirst({ where: { id: organizationId } });
    const base = getPublicBaseUrl(org as any);
    return `${base}/api/ical/export/${propertyId}`;
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
      event.summary = booking.client ? `${booking.client.firstName} ${booking.client.lastName}` : (booking.source || 'Reserva importada');
      event.startDate = ICAL.Time.fromJSDate(new Date(booking.checkInDate), true);
      event.endDate = ICAL.Time.fromJSDate(new Date(booking.checkOutDate), true);
      cal.addSubcomponent(vevent);
    }

    return cal.toString();
  }
}
