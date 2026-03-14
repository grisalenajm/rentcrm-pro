import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TranslationService } from '../translation/translation.service';
import { UpsertPropertyRulesDto } from './dto/upsert-property-rules.dto';

const ALL_LANGS = ['es', 'en', 'fr', 'de', 'it', 'pt', 'nl', 'da', 'nb', 'sv'];

@Injectable()
export class PropertyRulesService {
  constructor(
    private prisma: PrismaService,
    private translationService: TranslationService,
  ) {}

  private async verifyProperty(propertyId: string, organizationId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');
    return property;
  }

  async getRules(propertyId: string, organizationId: string) {
    await this.verifyProperty(propertyId, organizationId);
    return this.prisma.propertyRules.findUnique({ where: { propertyId } });
  }

  async upsertRules(propertyId: string, organizationId: string, dto: UpsertPropertyRulesDto) {
    await this.verifyProperty(propertyId, organizationId);
    return this.prisma.propertyRules.upsert({
      where: { propertyId },
      update: {
        baseContent: dto.baseContent,
        ...(dto.baseLanguage !== undefined ? { baseLanguage: dto.baseLanguage } : {}),
        ...(dto.translations !== undefined ? { translations: dto.translations } : {}),
        ...(dto.translationsEdited !== undefined ? { translationsEdited: dto.translationsEdited } : {}),
      },
      create: {
        propertyId,
        organizationId,
        baseContent: dto.baseContent,
        baseLanguage: dto.baseLanguage ?? 'es',
        translations: dto.translations ?? {},
        translationsEdited: dto.translationsEdited ?? [],
      },
    });
  }

  async translateRules(propertyId: string, organizationId: string) {
    await this.verifyProperty(propertyId, organizationId);
    const rules = await this.prisma.propertyRules.findUnique({ where: { propertyId } });
    if (!rules) throw new NotFoundException('No hay reglas para esta propiedad');

    const edited: string[] = Array.isArray(rules.translationsEdited) ? (rules.translationsEdited as string[]) : [];
    const existing = (rules.translations as Record<string, string>) ?? {};
    const baseLang = rules.baseLanguage || 'es';
    const targetLangs = ALL_LANGS.filter(l => l !== baseLang && !edited.includes(l));

    const updatedTranslations = { ...existing };
    for (const lang of targetLangs) {
      updatedTranslations[lang] = await this.translationService.translate(rules.baseContent, lang, baseLang);
    }

    return this.prisma.propertyRules.update({
      where: { propertyId },
      data: { translations: updatedTranslations },
    });
  }

  async getRulesForCheckin(propertyId: string, lang: string): Promise<string | null> {
    const rules = await this.prisma.propertyRules.findUnique({ where: { propertyId } });
    if (!rules) return null;
    const translations = rules.translations as Record<string, string>;
    if (translations?.[lang]) return translations[lang];
    return rules.baseContent;
  }
}
