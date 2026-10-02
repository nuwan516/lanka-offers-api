import express, { Express } from 'express';
import cors from 'cors';
import { config } from '../config/env';
import { correlationIdMiddleware } from '../middleware/correlation-id';
import { errorHandler, AppError } from '../middleware/error-handler';
import { healthRoutes } from '../modules/health/health.routes';
import { offerRoutes } from '../modules/offers/offer.routes';
import { merchantRoutes } from '../modules/merchants/merchant.routes';
import { bankRoutes } from '../modules/banks/bank.routes';

export function createApp(): Express {
  const app = express();

  // 1. Core middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow mobile clients or curl (origin === undefined)
        if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive for read-only public endpoints
        }
      },
      methods: ['GET', 'HEAD', 'OPTIONS'],
    })
  );
  app.use(express.json());
  app.use(correlationIdMiddleware);

  // 2. Public API route modules
  app.use('/api', healthRoutes);
  app.use('/api', offerRoutes);
  app.use('/api', merchantRoutes);
  app.use('/api', bankRoutes);

  // 3. Fallback for unhandled routes
  app.use('*', (req, _res, next) => {
    next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
  });

  // 4. Central error handler
  app.use(errorHandler);

  return app;
}
