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

    if (!propertyId) return global ?? { houseRules: null, arrivalGuide: null, localInfo: null };

    const specific = await this.prisma.propertyContent.findFirst({
      where: { organizationId, propertyId },
    });

    // Merge: use property-specific value if non-empty, otherwise fall back to global
    return {
      houseRules:   specific?.houseRules   || global?.houseRules   || null,
      arrivalGuide: specific?.arrivalGuide || global?.arrivalGuide || null,
      localInfo:    specific?.localInfo    || global?.localInfo    || null,
      _specific: specific ?? null,
      _global:   global   ?? null,
    };
  }

  async upsertContent(organizationId: string, dto: UpsertContentDto, propertyId?: string) {
    const existing = await this.prisma.propertyContent.findFirst({
      where: { organizationId, propertyId: propertyId ?? null },
    });
    if (existing) {
      return this.prisma.propertyContent.update({
        where: { id: existing.id },
        data: {
          houseRules:   dto.houseRules,
          arrivalGuide: dto.arrivalGuide,
          localInfo:    dto.localInfo,
        },
      });
    }
    return this.prisma.propertyContent.create({
      data: {
        organizationId,
        propertyId: propertyId ?? null,
        houseRules:   dto.houseRules,
        arrivalGuide: dto.arrivalGuide,
        localInfo:    dto.localInfo,
      },
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
