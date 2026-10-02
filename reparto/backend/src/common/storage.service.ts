import { Injectable } from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

const URL_TTL_SECONDS = 15 * 60;

/**
 * Guarda evidencias en disco local. En producción se reemplaza por S3/GCS
 * manteniendo esta misma interfaz.
 */
@Injectable()
export class StorageService {
  private readonly root = path.resolve(process.env.STORAGE_DIR || './storage');
  private readonly secret = process.env.EVIDENCE_SECRET || process.env.JWT_SECRET || 'dev';

  async save(buffer: Buffer, ext: string): Promise<{ key: string; sha256: string }> {
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const now = new Date();
    const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}${ext}`;
    const file = path.join(this.root, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buffer);
    return { key, sha256 };
  }

  filePath(key: string): string {
    const file = path.resolve(this.root, key);
    if (!file.startsWith(this.root + path.sep)) throw new Error('Clave inválida');
    return file;
  }

  signedUrl(evidenceId: string): string {
    const exp = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
    return `/api/evidences/${evidenceId}/file?exp=${exp}&sig=${this.sign(evidenceId, exp)}`;
  }

  verify(evidenceId: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(evidenceId, exp));
    const given = Buffer.from(sig || '');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private sign(evidenceId: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${evidenceId}:${exp}`).digest('hex');
  }
}
