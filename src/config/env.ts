import dotenv from 'dotenv';

// When running under test runners (e.g. Jest), preserve test environment
const isTestEnv = process.env.NODE_ENV === 'test';
dotenv.config({ override: !isTestEnv });
if (isTestEnv) {
  process.env.NODE_ENV = 'test';
}

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  isDesignatedPublicUrl: boolean;
  corsOrigins: string[];
  logLevel: string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Safely masks database credentials for logging purposes.
 * Replaces password with **** while preserving host, database, and query params.
 */
export function maskConnectionString(connectionString: string): string {
  if (!connectionString) return '<empty>';
  return connectionString.replace(/:[^:@]+@/, ':****@');
}

export interface ResolvedDbConfig {
  databaseUrl: string;
  isDesignatedPublicUrl: boolean;
  maskedUrl: string;
}

/**
 * Resolves and validates database configuration with strict environment fail-closed rules:
 * 1. In 'production', DATABASE_PUBLIC_URL is STRICTLY REQUIRED.
 *    No fallback to administrative owner credentials is permitted under any circumstances.
 *    Missing or invalid restricted credentials fail closed.
 * 2. In 'development' or 'test', DATABASE_PUBLIC_URL is preferred if set,
 *    safely falling back to DATABASE_URL or localhost for developer convenience.
 */
export function resolveDatabaseConfig(
  env: 'development' | 'production' | 'test',
  databasePublicUrl?: string,
  databaseUrl?: string
): ResolvedDbConfig {
  const publicUrl = databasePublicUrl?.trim();
  const fallbackUrl = databaseUrl?.trim();

  if (env === 'production') {
    if (!publicUrl) {
      throw new ConfigurationError(
        '[SECURITY FAIL-CLOSED] Production strictly requires DATABASE_PUBLIC_URL to enforce least-privilege role boundaries. Fallback to administrative or unconfigured credentials is prohibited.'
      );
    }
    return {
      databaseUrl: publicUrl,
      isDesignatedPublicUrl: true,
      maskedUrl: maskConnectionString(publicUrl),
    };
  }

  // Non-production modes (development / test)
  if (publicUrl) {
    return {
      databaseUrl: publicUrl,
      isDesignatedPublicUrl: true,
      maskedUrl: maskConnectionString(publicUrl),
    };
  }

  if (fallbackUrl) {
    return {
      databaseUrl: fallbackUrl,
      isDesignatedPublicUrl: false,
      maskedUrl: maskConnectionString(fallbackUrl),
    };
  }

  return {
    databaseUrl: '',
    isDesignatedPublicUrl: false,
    maskedUrl: '<empty>',
  };
}

const currentEnv = (process.env.NODE_ENV as AppConfig['env']) || 'development';
const resolvedDbConfig = resolveDatabaseConfig(
  currentEnv,
  process.env.DATABASE_PUBLIC_URL,
  process.env.DATABASE_URL
);

export const config: AppConfig = {
  env: currentEnv,
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: resolvedDbConfig.databaseUrl,
  isDesignatedPublicUrl: resolvedDbConfig.isDesignatedPublicUrl,
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  logLevel: process.env.LOG_LEVEL || 'info',
};
