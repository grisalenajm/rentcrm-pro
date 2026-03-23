import { Controller, Post, HttpCode, Logger, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service';
import { PaperlessService } from './paperless.service';
import { Public } from '../auth/public.decorator';

const INVOICE_TYPES = ['factura', 'invoice'];

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
  async webhook(@Req() req: Request): Promise<any> {
    try {
      const body = req.body;
      const secret = req.headers['x-paperless-secret'] as string;
      this.logger.log('RAW BODY: ' + JSON.stringify(body));
      this.logger.log('CONTENT-TYPE: ' + req.headers['content-type']);

      const org = await this.prisma.organization.findFirst();
      if (!org) return { ok: false };

      if (org.paperlessSecret && secret !== org.paperlessSecret) {
        return { ok: false, error: 'Unauthorized' };
      }

      // Accept 'Factura' or 'Invoice' (case-insensitive)
      const docTypeName: string = body.document_type_name ?? '';
      if (!INVOICE_TYPES.includes(docTypeName.toLowerCase())) {
        this.logger.log(`Paperless webhook: skipping document_type_name="${docTypeName}"`);
        return { ok: true };
      }

      // Find property by matching normalized correspondent_name to property name
      const correspondentName: string | undefined = body.correspondent_name;
      if (!correspondentName) {
        this.logger.warn('Paperless webhook: no correspondent_name in payload');
        return { ok: true };
      }

      const normalizedCorrespondent = correspondentName.replace(/_/g, ' ').trim().toLowerCase();

      const allProperties = await this.prisma.property.findMany({
        where: { organizationId: org.id },
      });
      const property = allProperties.find(
        (p) => p.name.replace(/_/g, ' ').trim().toLowerCase() === normalizedCorrespondent,
      ) ?? null;

      if (!property) {
        this.logger.warn(`Paperless webhook: no property found for correspondent_name="${correspondentName}" (normalized: "${normalizedCorrespondent}")`);
        return { ok: true };
      }

      // Extract document_id from doc_url
      const docUrl: string | undefined = body.doc_url;
      const match = docUrl?.match(/\/documents\/(\d+)\//);
      const documentId = match ? parseInt(match[1], 10) : null;

      // Fetch full document metadata to get custom fields and tags
      let doc: any = null;
      if (documentId) {
        try {
          doc = await this.paperless.getDocument(
            org.paperlessUrl ?? '',
            org.paperlessToken ?? '',
            documentId,
          );
        } catch (err: any) {
          this.logger.error(`Paperless getDocument error: ${err.message}`);
        }
      }

      // Determine expense type from tags
      let type = 'otros';
      if (doc?.tags) {
        const tagIds: number[] = Array.isArray(doc.tags)
          ? doc.tags.filter((t: any) => typeof t === 'number')
          : [];
        const tagMap: Record<string, string> = {
          agua: 'agua',
          luz: 'luz',
          internet: 'internet',
          limpieza: 'limpieza',
          tasas: 'tasas',
        };
        for (const tagId of tagIds) {
          try {
            const tagRes = await fetch(
              `${(org.paperlessUrl ?? '').replace(/\/$/, '')}/api/tags/${tagId}/`,
              { headers: { Authorization: `Token ${org.paperlessToken}` } },
            );
            if (tagRes.ok) {
              const tagData: any = await tagRes.json();
              const tagName = tagData.name?.toLowerCase() ?? '';
              if (tagMap[tagName]) { type = tagMap[tagName]; break; }
            }
          } catch { /* skip */ }
        }
      }

      // Parse amount from custom_fields
      // Field arrives as { value: "EUR1234.00", field: 8 } — no name, only numeric ID
      let amount = 0;
      if (doc?.custom_fields) {
        for (const cf of doc.custom_fields) {
          if (cf.value) {
            const cleaned = String(cf.value).replace(/[^0-9.,]/g, '').replace(',', '.');
            const parsed = parseFloat(cleaned);
            if (!isNaN(parsed) && parsed > 0) { amount = parsed; break; }
          }
        }
      }

      // Date: use body.created (ISO string), fallback to doc.created, then now
      const expenseDate = body.created
        ? new Date(body.created)
        : (doc?.created ? new Date(doc.created) : new Date());

      // Preview URL
      const previewUrl = docUrl
        ? docUrl.replace(/\/?$/, '') + '/preview/'
        : '';

      const fileName: string = body.original_file_name ?? doc?.original_file_name ?? '';

      await this.prisma.expense.create({
        data: {
          propertyId: property.id,
          date: expenseDate,
          amount,
          type,
          deductible: false,
          paperlessDocumentId: documentId,
          paperlessAmount: amount,
          notes: `${fileName}${previewUrl ? ' — ' + previewUrl : ''}`.trim(),
        },
      });

      this.logger.log(
        `Paperless webhook: created Expense for property ${property.id}, doc ${documentId}, amount ${amount}`,
      );
      return { ok: true };
    } catch (err: any) {
      this.logger.error('Webhook error', err.stack);
      return { ok: false, error: 'unexpected_error' };
    }
  }
}
