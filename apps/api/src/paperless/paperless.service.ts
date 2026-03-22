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

    const tagIds = await Promise.all(
      tags.map(t => this.resolveTagId(paperlessUrl, paperlessToken, t)),
    );

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
    tagIds.forEach(id => formData.append('tags', String(id)));

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

  private async resolveTagId(
    paperlessUrl: string,
    paperlessToken: string,
    tagName: string,
  ): Promise<number> {
    const base = paperlessUrl.replace(/\/$/, '');
    const headers = {
      Authorization: `Token ${paperlessToken}`,
      'Content-Type': 'application/json',
    };

    const searchRes = await fetch(
      `${base}/api/tags/?name=${encodeURIComponent(tagName)}`,
      { headers },
    );
    if (!searchRes.ok) {
      throw new Error(`Paperless tags search respondió ${searchRes.status}`);
    }
    const searchData: any = await searchRes.json();
    if (searchData.results?.length > 0) {
      return searchData.results[0].id as number;
    }

    const createRes = await fetch(`${base}/api/tags/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: tagName }),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`Paperless tags create respondió ${createRes.status}: ${body}`);
    }
    const created: any = await createRes.json();
    this.logger.log(`Paperless tag creado: "${tagName}" → id ${created.id}`);
    return created.id as number;
  }

  async getDocument(
    paperlessUrl: string,
    paperlessToken: string,
    documentId: number,
  ): Promise<any> {
    const url = `${paperlessUrl.replace(/\/$/, '')}/api/documents/${documentId}/`;
    const response = await fetch(url, {
      headers: { Authorization: `Token ${paperlessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Paperless getDocument respondió ${response.status}`);
    }
    return response.json();
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
