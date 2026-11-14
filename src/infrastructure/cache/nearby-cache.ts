/**
 * Redis cache for nearby offers queries.
 *
 * Cache key: rounded lat/lng (~100m), radius, filters, pagination.
 * TTL: 5–10 minutes (default 420s). Nearby results are approximate enough
 * that short-lived staleness is acceptable.
 *
 * Invalidation strategy:
 * - Primary: TTL expiry (safe default; no cross-service coupling required).
 * - Optional: call invalidateNearbyCache() after publish/geo updates when
 *   REDIS_URL is shared with the admin API (pattern: nearby:v1:*).
 * - Optional: bump NEARBY_CACHE_VERSION env to flush logically without SCAN.
 *
 * REDIS_URL unset → cache is a no-op (queries hit Postgres directly).
 */

import { config } from '../../config/env';
import { NearbyOffersQueryOptions, PaginatedResult, PublicOfferSummary } from '../../modules/offers/offer.types';

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttlSeconds: number): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
  quit(): Promise<void>;
};

let redisClient: RedisLike | null | undefined;
let redisInitFailed = false;

async function getRedis(): Promise<RedisLike | null> {
  if (!config.redisUrl || redisInitFailed) return null;
  if (redisClient !== undefined) return redisClient;

  try {
    // Dynamic import keeps Redis optional when REDIS_URL is unset.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require('ioredis') as new (url: string, opts?: object) => RedisLike & {
      on(event: string, cb: (...args: unknown[]) => void): void;
      status: string;
    };
    const client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 2000,
    });
    client.on('error', () => {
      /* swallow — nearby cache must never break the API */
    });
    const maybeConnect = (client as unknown as { connect?: () => Promise<void> }).connect;
    if (typeof maybeConnect === 'function') {
      await maybeConnect.call(client);
    }
    redisClient = client;
    return redisClient;
  } catch {
    redisInitFailed = true;
    redisClient = null;
    return null;
  }
}

/** Round to ~100m: 0.001° ≈ 111m at equator. */
export function roundCoordForCache(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildNearbyCacheKey(options: NearbyOffersQueryOptions & { limit: number; offset: number; radius: number }): string {
  const version = config.nearbyCacheVersion;
  const lat = roundCoordForCache(options.lat).toFixed(3);
  const lng = roundCoordForCache(options.lng).toFixed(3);
  const radius = Math.round(options.radius * 10) / 10;
  const bank = (options.bank ?? '').toLowerCase();
  const category = (options.category ?? '').toLowerCase();
  const search = (options.search ?? '').toLowerCase().trim();
  const nationwide = options.includeNationwide ? '1' : '0';
  return `nearby:v${version}:${lat}:${lng}:r${radius}:b${bank}:c${category}:s${search}:n${nationwide}:l${options.limit}:o${options.offset}`;
}

export async function getCachedNearby(
  options: NearbyOffersQueryOptions & { limit: number; offset: number; radius: number }
): Promise<PaginatedResult<PublicOfferSummary> | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(buildNearbyCacheKey(options));
    if (!raw) return null;
    return JSON.parse(raw) as PaginatedResult<PublicOfferSummary>;
  } catch {
    return null;
  }
}

export async function setCachedNearby(
  options: NearbyOffersQueryOptions & { limit: number; offset: number; radius: number },
  value: PaginatedResult<PublicOfferSummary>
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.set(
      buildNearbyCacheKey(options),
      JSON.stringify(value),
      'EX',
      config.nearbyCacheTtlSeconds
    );
  } catch {
    /* ignore cache write failures */
  }
}

/**
 * Best-effort invalidation after publish/geo changes.
 * Prefer bumping NEARBY_CACHE_VERSION in production over broad KEYS scans.
 */
export async function invalidateNearbyCache(): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;
  try {
    const pattern = `nearby:v${config.nearbyCacheVersion}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return redis.del(...keys);
  } catch {
    return 0;
  }
}

export async function closeNearbyCache(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      /* ignore */
    }
    redisClient = undefined;
  }
}
