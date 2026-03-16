import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { getStaticTranslation } from './ui-translations';

export const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'da', name: 'Dansk' },
  { code: 'nb', name: 'Norsk' },
  { code: 'sv', name: 'Svenska' },
];

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly baseUrl = process.env.LIBRETRANSLATE_URL || 'http://libretranslate:5000';

  async translate(text: string, targetLang: string, sourceLang = 'es'): Promise<string> {
    if (!text || targetLang === sourceLang) return text;

    // Check static cache first — no network call needed
    if (sourceLang === 'es') {
      const cached = getStaticTranslation(text, targetLang);
      if (cached !== null) return cached;
    }

    // Fall back to LibreTranslate for dynamic content (e.g. welcome package HTML)
    try {
      const response = await axios.post(`${this.baseUrl}/translate`, {
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text',
      }, { timeout: 10000 });
      return response.data.translatedText || text;
    } catch (error) {
      this.logger.warn(`LibreTranslate unavailable for ${targetLang}: ${error.message}. Using original text.`);
      return text;
    }
  }

  async translateMany(texts: string[], targetLang: string, sourceLang = 'es'): Promise<string[]> {
    if (targetLang === sourceLang) return texts;
    return Promise.all(texts.map(t => this.translate(t, targetLang, sourceLang)));
  }
}
