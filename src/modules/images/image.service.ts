import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/env';
import { db } from '../../infrastructure/db/db-client';

const KEY_PATTERN = /^[a-f0-9]{64}\.(jpg|png|gif|webp)$/;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export interface ResolvedOfferImage {
  bytes: Buffer;
  contentType: string;
}

/**
 * Serves content-addressed offer images only when the key belongs to a
 * currently published, non-expired offer. Path traversal is rejected.
 */
export class ImageService {
  public async getPublishedImage(rawKey: string): Promise<ResolvedOfferImage | null> {
    const key = String(rawKey ?? '').toLowerCase();
    const match = KEY_PATTERN.exec(key);
    if (!match) return null;

    const visible = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM offers
         WHERE image_storage_key = $1
           AND db_status = 'PUBLISHED'
           AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
       ) AS exists`,
      [key]
    );
    if (!visible.rows[0]?.exists) return null;

    const storageRoot = path.resolve(config.imageStorageDir);
    const filePath = path.resolve(storageRoot, key);
    if (path.dirname(filePath) !== storageRoot) return null;

    try {
      const bytes = await fs.readFile(filePath);
      return {
        bytes,
        contentType: MIME_BY_EXTENSION[match[1]],
      };
    } catch {
      return null;
    }
  }
}
