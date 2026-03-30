import { Controller, Post, Get, HttpCode, Logger, Req, Res, Param, Query, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma.service';
import { PaperlessService } from './paperless.service';
import { RedisService } from './redis.service';
import { LogsService } from '../logs/logs.service';
import { Public } from '../auth/public.decorator';

const INVOICE_TYPES = ['factura', 'invoice'];
const DOC_TOKEN_TTL = 300; // seconds

@Controller('paperless')
export class PaperlessController {
  private readonly logger = new Logger(PaperlessController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paperless: PaperlessService,
    private readonly redis: RedisService,
    private readonly logsService: LogsService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request): Promise<any> {
    try {
      const body = req.body;
      const secret = req.headers['x-paperless-secret'] as string;

      const org = await this.prisma.organization.findFirst();
      if (!org) return { ok: false };

      if (!org.paperlessSecret) {
        return { ok: false, error: 'Webhook secret not configured' };
      }
      const secretValid = timingSafeEqual(
        Buffer.from(secret || ''),
        Buffer.from(org.paperlessSecret),
      );
      if (!secretValid) {
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
        await this.logsService.add('warn', 'Paperless', 'Webhook recibido sin correspondent_name', { body });
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
        await this.logsService.add('warn', 'Paperless', `Corresponsal "${correspondentName}" no coincide con ninguna propiedad`, { normalizedCorrespondent });
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
      // Field arrives as { value: "EUR1.476,20", field: 8 } — no name, only numeric ID
      // European format: dot = thousands separator, comma = decimal  → EUR1.476,20 → 1476.20
      // ISO/simple format: dot = decimal, no comma                   → EUR1234.00  → 1234.00
      // Only accept values that start with a currency symbol (EUR/USD/GBP/€/$)
      // or whose stripped form contains a decimal separator (comma or dot),
      // to avoid false positives like "53xqAwLrrfhKgHcH" → "53".
      let amount = 0;
      if (doc?.custom_fields) {
        for (const cf of doc.custom_fields) {
          if (cf.value) {
            const rawStr = String(cf.value).trim();
            const isCurrencyPrefixed = /^(EUR|USD|GBP|[€$])/.test(rawStr);
            const stripped = rawStr.replace(/[^0-9.,]/g, '');
            const hasDecimalSeparator = stripped.includes(',') || stripped.includes('.');
            if (!isCurrencyPrefixed && !hasDecimalSeparator) continue;
            const cleaned = stripped.includes(',')
              ? stripped.replace(/\./g, '').replace(',', '.')
              : stripped;
            const parsed = parseFloat(cleaned);
            if (!isNaN(parsed) && parsed > 0) { amount = parsed; break; }
          }
        }
      }

      // Date: use body.created (ISO string), fallback to doc.created, then now
      const expenseDate = body.created
        ? new Date(body.created)
        : (doc?.created ? new Date(doc.created) : new Date());

      const fileName: string = body.original_file_name ?? doc?.original_file_name ?? '';

      const existingExpense = documentId
        ? await this.prisma.expense.findFirst({ where: { paperlessDocumentId: documentId } })
        : null;

      if (existingExpense) {
        await this.prisma.expense.update({
          where: { id: existingExpense.id },
          data: { amount, paperlessAmount: amount, notes: fileName || existingExpense.notes },
        });
        this.logger.log(`Paperless webhook: updated Expense ${existingExpense.id} for doc ${documentId}, amount ${amount}`);
        await this.logsService.add('info', 'Paperless', `Gasto actualizado desde documento — ${property.name} — ${amount}€`, { propertyId: property.id, documentId, amount, type, fileName });
      } else {
        await this.prisma.expense.create({
          data: {
            propertyId: property.id,
            date: expenseDate,
            amount,
            type,
            deductible: false,
            paperlessDocumentId: documentId,
            paperlessAmount: amount,
            notes: fileName || null,
          },
        });
        this.logger.log(`Paperless webhook: created Expense for property ${property.id}, doc ${documentId}, amount ${amount}`);
        await this.logsService.add('info', 'Paperless', `Gasto creado desde documento — ${property.name} — ${amount}€`, { propertyId: property.id, documentId, amount, type, fileName });
      }
      return { ok: true };
    } catch (err: any) {
      this.logger.error('Webhook error', err.stack);
      await this.logsService.add('error', 'Paperless', `Error inesperado en webhook: ${err.message}`, { error: err.message });
      return { ok: false, error: 'unexpected_error' };
    }
  }

  // Issue a one-time token for a specific document (requires JWT)
  @Post('document/:id/token')
  async issueDocumentToken(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ token: string }> {
    const user = (req as any).user;
    const token = randomUUID();
    const payload = JSON.stringify({ documentId: id, userId: user?.id ?? '' });
    await this.redis.client.set(`paperless:doctoken:${token}`, payload, 'EX', DOC_TOKEN_TTL);
    return { token };
  }

  // Proxy Paperless PDF — @Public(), validated via one-time token in query param
  @Public()
  @Get('document/:id')
  async proxyDocument(
    @Param('id') id: string,
    @Query('access_token') accessToken: string,
    @Res() res: Response,
  ): Promise<void> {
    // Validate one-time token
    if (!accessToken) {
      res.status(401).json({ error: 'Missing access_token' });
      return;
    }

    const raw = await this.redis.client.get(`paperless:doctoken:${accessToken}`);
    if (!raw) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    let payload: { documentId: string; userId: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      res.status(401).json({ error: 'Malformed token payload' });
      return;
    }

    if (payload.documentId !== id) {
      res.status(401).json({ error: 'Token document mismatch' });
      return;
    }

    // Consume token immediately (one-time use)
    await this.redis.client.del(`paperless:doctoken:${accessToken}`);

    const org = await this.prisma.organization.findFirst();
    if (!org?.paperlessUrl || !org?.paperlessToken) {
      res.status(503).json({ error: 'Paperless not configured' });
      return;
    }

    const url = `${org.paperlessUrl.replace(/\/$/, '')}/api/documents/${id}/download/`;
    const upstream = await fetch(url, {
      headers: { Authorization: `Token ${org.paperlessToken}` },
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Document not found in Paperless' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="documento.pdf"');

    const reader = upstream.body?.getReader();
    if (!reader) { res.end(); return; }

    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(Buffer.from(value));
      return pump();
    };
    await pump();
  }
}
