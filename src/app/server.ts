import { createApp } from './app';
import { config, maskConnectionString } from '../config/env';
import { db } from '../infrastructure/db/db-client';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[LankaOffers Backend API] Listening on port ${config.port} (${config.env})`);
  if (config.isDesignatedPublicUrl) {
    console.log(`[LankaOffers Backend API] Database security: Restricted public role active (${maskConnectionString(config.databaseUrl)})`);
  } else {
    console.log(`[LankaOffers Backend API] Database security: Local/fallback connection (${maskConnectionString(config.databaseUrl)})`);
  }
  console.log(`[LankaOffers Backend API] Health check: http://localhost:${config.port}/api/health`);
  console.log(`[LankaOffers Backend API] Offers: http://localhost:${config.port}/api/offers`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('[LankaOffers Backend API] Shutting down gracefully...');
  server.close(async () => {
    await db.close();
    console.log('[LankaOffers Backend API] Closed connections. Process exiting.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
