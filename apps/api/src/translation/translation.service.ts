import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';

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
export class TranslationService implements OnModuleInit {
  private readonly logger = new Logger(TranslationService.name);
  private readonly baseUrl = process.env.LIBRETRANSLATE_URL || 'http://libretranslate:5000';

  async onModuleInit() {
    this.logger.log('Pre-calentando caché de traducciones...');
    const textos = [
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
      'ID nacional',
      'Pasaporte',
      'NIE / ID extranjero',
      'Otro',
      'España',
      'Reino Unido',
      'Francia',
      'Alemania',
      'Italia',
      'Portugal',
      'Estados Unidos',
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
    ];

    const idiomas = ['en', 'fr', 'de', 'it', 'pt', 'nl', 'da', 'nb', 'sv'];

    for (const lang of idiomas) {
      await Promise.all(textos.map(t => this.translate(t, lang, 'es')));
      this.logger.log(`Caché calentada para idioma: ${lang}`);
    }

    this.logger.log('Caché de traducciones lista.');
  }

  async translate(text: string, targetLang: string, sourceLang = 'es'): Promise<string> {
    if (!text || targetLang === sourceLang) return text;
    try {
      const response = await axios.post(`${this.baseUrl}/translate`, {
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text',
      }, { timeout: 10000 });
      return response.data.translatedText || text;
    } catch (error) {
      this.logger.warn(`Error traduciendo a ${targetLang}: ${error.message}. Usando texto original.`);
      return text;
    }
  }

  async translateMany(texts: string[], targetLang: string, sourceLang = 'es'): Promise<string[]> {
    if (targetLang === sourceLang) return texts;
    return Promise.all(texts.map(t => this.translate(t, targetLang, sourceLang)));
  }
}
