import { Request, Response } from 'express';
import { db } from '../../database/db-client';

export class HealthController {
  public async getHealth(_req: Request, res: Response): Promise<void> {
    const dbHealthy = await db.checkHealth();
    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json({
      status: dbHealthy ? 'healthy' : 'degraded',
      service: 'lanka-offers-backend-api',
      version: '1.0.0',
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }
}
