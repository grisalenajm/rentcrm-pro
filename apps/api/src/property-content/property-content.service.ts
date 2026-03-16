import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpsertContentDto } from './dto/upsert-content.dto';
import { AddDocumentDto } from './dto/add-document.dto';

@Injectable()
export class PropertyContentService {
  constructor(private prisma: PrismaService) {}

  async getContent(organizationId: string, propertyId?: string) {
    const global = await this.prisma.propertyContent.findFirst({
      where: { organizationId, propertyId: null },
    });

    if (!propertyId) {
      return { template: global?.template ?? null, _specific: null, _global: global ?? null };
    }

    const specific = await this.prisma.propertyContent.findFirst({
      where: { organizationId, propertyId },
    });

    return {
      // Merged: use property template if non-empty, else global
      template: specific?.template || global?.template || null,
      _specific: specific ?? null,
      _global:   global   ?? null,
    };
  }

  async upsertContent(organizationId: string, dto: UpsertContentDto, propertyId?: string) {
    const existing = await this.prisma.propertyContent.findFirst({
      where: { organizationId, propertyId: propertyId ?? null },
    });
    if (existing) {
      // If template changed, invalidate translation cache
      const templateChanged = existing.template !== dto.template;
      return this.prisma.propertyContent.update({
        where: { id: existing.id },
        data: {
          template: dto.template,
          ...(templateChanged ? { translations: {} } : {}),
        },
      });
    }
    return this.prisma.propertyContent.create({
      data: {
        organizationId,
        propertyId: propertyId ?? null,
        template: dto.template,
      },
    });
  }

  /**
   * Returns the cached translated template for a given language, or null if not cached.
   * The ownerRecord is whichever PropertyContent record provides the active template.
   */
  getCachedTemplateTranslation(ownerRecord: any, lang: string): string | null {
    if (!ownerRecord) return null;
    const translations = ownerRecord.translations as Record<string, string> | null;
    return translations?.[lang] ?? null;
  }

  /**
   * Stores a translated template in the PropertyContent record's translations cache.
   */
  async cacheTemplateTranslation(recordId: string, lang: string, translatedHtml: string): Promise<void> {
    const record = await this.prisma.propertyContent.findUnique({ where: { id: recordId } });
    if (!record) return;
    const translations = (record.translations as Record<string, string>) ?? {};
    translations[lang] = translatedHtml;
    await this.prisma.propertyContent.update({
      where: { id: recordId },
      data: { translations },
    });
  }

  async getDocuments(organizationId: string, propertyId?: string) {
    const where = propertyId
      ? { organizationId, OR: [{ propertyId }, { propertyId: null }] }
      : { organizationId, propertyId: null };

    return this.prisma.propertyDocument.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, fileSize: true, order: true, propertyId: true, createdAt: true },
    });
  }

  async getDocumentsWithData(organizationId: string, propertyId?: string) {
    const where = propertyId
      ? { organizationId, OR: [{ propertyId }, { propertyId: null }] }
      : { organizationId, propertyId: null };

    return this.prisma.propertyDocument.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addDocument(organizationId: string, dto: AddDocumentDto, propertyId?: string) {
    return this.prisma.propertyDocument.create({
      data: {
        organizationId,
        propertyId: propertyId ?? null,
        name:     dto.name,
        fileData: dto.fileData,
        fileSize: dto.fileSize,
        order:    dto.order ?? 0,
      },
      select: { id: true, name: true, fileSize: true, order: true, propertyId: true, createdAt: true },
    });
  }

  async removeDocument(organizationId: string, documentId: string) {
    const doc = await this.prisma.propertyDocument.findFirst({
      where: { id: documentId, organizationId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return this.prisma.propertyDocument.delete({ where: { id: documentId } });
  }

  async reorderDocuments(organizationId: string, ids: string[]) {
    await Promise.all(
      ids.map((id, index) =>
        this.prisma.propertyDocument.updateMany({
          where: { id, organizationId },
          data: { order: index },
        }),
      ),
    );
    return { ok: true };
  }
}
