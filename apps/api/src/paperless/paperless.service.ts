import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PaperlessService {
  private readonly logger = new Logger(PaperlessService.name);

  async uploadDocument(
    paperlessUrl: string | null | undefined,
    paperlessToken: string | null | undefined,
    pdfBuffer: Buffer,
    title: string,
    tags: string[],
  ): Promise<number | null> {
    if (!paperlessUrl || !paperlessToken) {
      throw new Error(
        'Paperless-ngx no está configurado. Configure URL y token en Ajustes → Gestión documental.',
      );
    }

    const url = `${paperlessUrl.replace(/\/$/, '')}/api/documents/post_document/`;

    const formData = new FormData();
    const arrayBuf: ArrayBuffer = pdfBuffer.buffer instanceof ArrayBuffer
      ? pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer
      : new Uint8Array(pdfBuffer).buffer;
    formData.append(
      'document',
      new Blob([arrayBuf], { type: 'application/pdf' }),
      `${title}.pdf`,
    );
    formData.append('title', title);
    for (const tag of tags) {
      formData.append('tags', tag);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Token ${paperlessToken}` },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Paperless respondió ${response.status}: ${body}`);
    }

    const data: any = await response.json();
    this.logger.log(`Paperless upload response: ${JSON.stringify(data)}`);

    // Paperless-ngx ≥ 2.x devuelve task UUID; versiones antiguas devuelven document id como number
    if (typeof data === 'number') return data;
    if (typeof data === 'object' && data !== null && typeof data.id === 'number') return data.id;
    return null;
  }

  async testConnection(
    paperlessUrl: string,
    paperlessToken: string,
  ): Promise<{ ok: boolean; message: string }> {
    const url = `${paperlessUrl.replace(/\/$/, '')}/api/documents/?page_size=1`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Token ${paperlessToken}` },
      });
      if (!response.ok) {
        return { ok: false, message: `Error ${response.status} al conectar con Paperless-ngx` };
      }
      return { ok: true, message: 'Conexión correcta con Paperless-ngx' };
    } catch (err: any) {
      return { ok: false, message: `No se pudo conectar: ${err.message}` };
    }
  }
}
