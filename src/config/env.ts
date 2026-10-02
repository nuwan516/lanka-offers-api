import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  logLevel: string;
}

export const config: AppConfig = {
  env: (process.env.NODE_ENV as AppConfig['env']) || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  logLevel: process.env.LOG_LEVEL || 'info',
};
