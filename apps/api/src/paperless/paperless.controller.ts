import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PaperlessService } from './paperless.service';
import { Public } from '../auth/public.decorator';

@Controller('paperless')
export class PaperlessController {
  private readonly logger = new Logger(PaperlessController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paperless: PaperlessService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Body() body: any,
    @Headers('x-paperless-secret') secret: string,
  ) {
    const org = await this.prisma.organization.findFirst();
    if (!org) return { ok: false };

    if (org.paperlessSecret && secret !== org.paperlessSecret) {
      return { ok: false, error: 'Unauthorized' };
    }

    if (body.document_type_name !== 'Factura') {
      return { ok: true };
    }

    const correspondentId: number | undefined = body.correspondent;
    if (!correspondentId) {
      this.logger.warn('Paperless webhook: no correspondent in payload');
      return { ok: true };
    }

    const property = await this.prisma.property.findFirst({
      where: { paperlessCorrespondentId: correspondentId },
    });
    if (!property) {
      this.logger.warn(`Paperless webhook: no property found for correspondentId=${correspondentId}`);
      return { ok: true };
    }

    let doc: any;
    try {
      doc = await this.paperless.getDocument(
        org.paperlessUrl ?? '',
        org.paperlessToken ?? '',
        body.document_id,
      );
    } catch (err: any) {
      this.logger.error(`Paperless getDocument error: ${err.message}`);
      return { ok: true };
    }

    // Determine expense type from tags
    const tags: string[] = (doc.tags_name ?? doc.tags ?? []).map((t: any) =>
      typeof t === 'string' ? t.toLowerCase() : '',
    );
    const tagMap: Record<string, string> = {
      agua: 'agua',
      luz: 'luz',
      internet: 'internet',
      limpieza: 'limpieza',
      tasas: 'tasas',
    };
    let type = 'otros';
    for (const tag of tags) {
      if (tagMap[tag]) { type = tagMap[tag]; break; }
    }

    // Parse amount from custom_fields or title
    let amount = 0;
    if (doc.custom_fields) {
      for (const cf of doc.custom_fields) {
        if (cf.field?.name?.toLowerCase().includes('importe') && cf.value) {
          const parsed = parseFloat(String(cf.value).replace(',', '.'));
          if (!isNaN(parsed)) { amount = parsed; break; }
        }
      }
    }

    const previewUrl = `${(org.paperlessUrl ?? '').replace(/\/$/, '')}/documents/${body.document_id}/preview/`;

    await this.prisma.expense.create({
      data: {
        propertyId: property.id,
        date: doc.created ? new Date(doc.created) : new Date(),
        amount,
        type,
        deductible: false,
        paperlessDocumentId: body.document_id,
        paperlessAmount: amount,
        notes: `${doc.original_file_name ?? body.original_file_name ?? ''} — ${previewUrl}`,
      },
    });

    this.logger.log(`Paperless webhook: created Expense for property ${property.id}, doc ${body.document_id}`);
    return { ok: true };
  }
}
