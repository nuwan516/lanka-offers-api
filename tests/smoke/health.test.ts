import request from 'supertest';
import { createApp } from '../../src/app/app';
import { db } from '../../src/database/db-client';

jest.mock('../../src/database/db-client', () => ({
  db: {
    checkHealth: jest.fn(),
  },
}));

describe('Smoke Test: GET /api/health', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and healthy status when database is reachable', async () => {
    (db.checkHealth as jest.Mock).mockResolvedValueOnce(true);

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('database', 'connected');
    expect(response.body).toHaveProperty('version');
    expect(response.headers).toHaveProperty('x-correlation-id');
  });

  it('should return 503 and degraded status when database is unreachable', async () => {
    (db.checkHealth as jest.Mock).mockResolvedValueOnce(false);

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('status', 'degraded');
    expect(response.body).toHaveProperty('database', 'disconnected');
  });
});
