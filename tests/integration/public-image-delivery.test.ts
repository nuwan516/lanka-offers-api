import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/app/app';
import { db } from '../../src/infrastructure/db/db-client';

describe('public immutable image delivery', () => {
  const key = `${'a'.repeat(64)}.png`;
  let storageDir: string;

  beforeAll(async () => {
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lanka-public-images-'));
    process.env.IMAGE_STORAGE_DIR = storageDir;
    await fs.writeFile(path.join(storageDir, key), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('serves exact bytes with immutable caching only when an active published offer references the key', async () => {
    jest.spyOn(db, 'query').mockResolvedValueOnce({ rows: [{ exists: true }] } as never);
    const response = await request(createApp()).get(`/api/images/${key}`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.body).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('does not expose staged, withdrawn, expired, or otherwise unreferenced assets', async () => {
    jest.spyOn(db, 'query').mockResolvedValueOnce({ rows: [{ exists: false }] } as never);
    const response = await request(createApp()).get(`/api/images/${key}`);
    expect(response.status).toBe(404);
  });

  it('rejects path traversal and non-content-addressed filenames before database or filesystem access', async () => {
    jest.clearAllMocks();
    const query = jest.spyOn(db, 'query');
    const response = await request(createApp()).get('/api/images/not-a-content-hash.png');
    expect(response.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });
});
