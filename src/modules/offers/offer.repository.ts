import { db } from '../../database/db-client';
import { PAGINATION } from '../../config/constants';
import {
  NearbyOffersQueryOptions,
  OfferListQueryOptions,
  PaginatedResult,
  PublicOfferDetail,
  PublicOfferSummary,
} from './offer.types';

const PUBLIC_SUMMARY_COLUMNS = `
  id, unique_id, bank, source_url, title, category, card_type,
  merchant_name, merchant_location, canonical_merchant, location_scope,
  discount_percentage, valid_from, valid_to, card_eligibility,
  geo_locations, geo_status, db_status,
  COALESCE(
    SUBSTRING(raw_offer->'offer'->>'description' FROM 1 FOR 200),
    title
  ) AS description,
  created_at, updated_at
`;

const PUBLIC_DETAIL_COLUMNS = `
  id, unique_id, bank, source_url, title, category, card_type,
  merchant_name, merchant_location, canonical_merchant, location_scope,
  discount_percentage, valid_from, valid_to, card_eligibility,
  geo_locations, geo_status, raw_offer, db_status,
  COALESCE(
    raw_offer->'offer'->>'description',
    title
  ) AS description,
  raw_offer->'offer'->>'terms' AS terms,
  created_at, updated_at
`;

export class OfferRepository {
  public async findPublishedOffers(
    options: OfferListQueryOptions
  ): Promise<PaginatedResult<PublicOfferSummary>> {
    const conditions: string[] = [
      "db_status = 'PUBLISHED'",
      "(valid_to IS NULL OR valid_to >= CURRENT_DATE)",
    ];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.bank) {
      conditions.push(`bank = $${paramIndex++}`);
      params.push(options.bank.toLowerCase());
    }

    if (options.category) {
      conditions.push(`category ILIKE $${paramIndex++}`);
      params.push(options.category);
    }

    if (options.locationScope) {
      conditions.push(`location_scope = $${paramIndex++}`);
      params.push(options.locationScope);
    }

    if (options.merchant) {
      conditions.push(`(merchant_name ILIKE $${paramIndex} OR canonical_merchant ILIKE $${paramIndex})`);
      params.push(`%${options.merchant}%`);
      paramIndex++;
    }

    if (options.search) {
      conditions.push(
        `(title ILIKE $${paramIndex} OR merchant_name ILIKE $${paramIndex} OR canonical_merchant ILIKE $${paramIndex})`
      );
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    const limit = Math.min(
      Math.max(options.limit ?? PAGINATION.DEFAULT_LIMIT, 1),
      PAGINATION.MAX_LIMIT
    );
    const offset = Math.max(options.offset ?? PAGINATION.DEFAULT_OFFSET, 0);

    const dataSql = `
      SELECT ${PUBLIC_SUMMARY_COLUMNS}
      FROM offers
      ${whereSql}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM offers
      ${whereSql}
    `;

    const [dataRes, countRes] = await Promise.all([
      db.query<PublicOfferSummary>(dataSql, [...params, limit, offset]),
      db.query<{ count: number }>(countSql, params),
    ]);

    return {
      items: dataRes.rows,
      total: countRes.rows[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  public async findNearbyOffers(
    options: NearbyOffersQueryOptions
  ): Promise<PaginatedResult<PublicOfferSummary>> {
    const radius = Math.min(Math.max(options.radius ?? 25, 0.5), 100);
    const limit = Math.min(
      Math.max(options.limit ?? PAGINATION.DEFAULT_LIMIT, 1),
      PAGINATION.MAX_LIMIT
    );
    const offset = Math.max(options.offset ?? PAGINATION.DEFAULT_OFFSET, 0);

    const conditions: string[] = [
      "o.db_status = 'PUBLISHED'",
      "(o.valid_to IS NULL OR o.valid_to >= CURRENT_DATE)",
      "o.geo_locations IS NOT NULL",
      "jsonb_array_length(o.geo_locations) > 0",
      "(loc->>'lat') IS NOT NULL",
      "(loc->>'lng') IS NOT NULL",
    ];

    const params: unknown[] = [options.lat, options.lng, radius];
    let paramIndex = 4;

    if (options.bank) {
      conditions.push(`o.bank = $${paramIndex++}`);
      params.push(options.bank.toLowerCase());
    }

    if (options.category) {
      conditions.push(`o.category ILIKE $${paramIndex++}`);
      params.push(options.category);
    }

    if (options.search) {
      conditions.push(
        `(o.title ILIKE $${paramIndex} OR o.merchant_name ILIKE $${paramIndex} OR o.canonical_merchant ILIKE $${paramIndex})`
      );
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    const dataSql = `
      WITH unnested_locations AS (
        SELECT 
          o.id, o.unique_id, o.bank, o.source_url, o.title, o.category, o.card_type,
          o.merchant_name, o.merchant_location, o.canonical_merchant, o.location_scope,
          o.discount_percentage, o.valid_from, o.valid_to, o.card_eligibility,
          o.geo_locations, o.geo_status, o.db_status, o.created_at, o.updated_at,
          COALESCE(
            SUBSTRING(o.raw_offer->'offer'->>'description' FROM 1 FOR 200),
            o.title
          ) AS description,
          (
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians($1)) * cos(radians((loc->>'lat')::float)) *
                cos(radians((loc->>'lng')::float) - radians($2)) +
                sin(radians($1)) * sin(radians((loc->>'lat')::float))
              ))
            )
          ) AS dist_km
        FROM offers o,
        jsonb_array_elements(o.geo_locations) AS loc
        ${whereSql}
      ),
      aggregated AS (
        SELECT 
          id, unique_id, bank, source_url, title, category, card_type,
          merchant_name, merchant_location, canonical_merchant, location_scope,
          discount_percentage, valid_from, valid_to, card_eligibility,
          geo_locations, geo_status, db_status, description, created_at, updated_at,
          ROUND(MIN(dist_km)::numeric, 1)::float AS distance_km
        FROM unnested_locations
        WHERE dist_km <= $3
        GROUP BY id, unique_id, bank, source_url, title, category, card_type,
                 merchant_name, merchant_location, canonical_merchant, location_scope,
                 discount_percentage, valid_from, valid_to, card_eligibility,
                 geo_locations, geo_status, db_status, description, created_at, updated_at
      )
      SELECT *
      FROM aggregated
      ORDER BY distance_km ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const countSql = `
      WITH unnested_locations AS (
        SELECT 
          o.id,
          (
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians($1)) * cos(radians((loc->>'lat')::float)) *
                cos(radians((loc->>'lng')::float) - radians($2)) +
                sin(radians($1)) * sin(radians((loc->>'lat')::float))
              ))
            )
          ) AS dist_km
        FROM offers o,
        jsonb_array_elements(o.geo_locations) AS loc
        ${whereSql}
      )
      SELECT COUNT(DISTINCT id)::int AS count
      FROM unnested_locations
      WHERE dist_km <= $3
    `;

    const [dataRes, countRes] = await Promise.all([
      db.query<PublicOfferSummary>(dataSql, [...params, limit, offset]),
      db.query<{ count: number }>(countSql, params),
    ]);

    return {
      items: dataRes.rows,
      total: countRes.rows[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  public async findPublishedOfferById(idOrUniqueId: string): Promise<PublicOfferDetail | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrUniqueId);
    
    const condition = isUuid ? 'id = $1' : 'unique_id = $1';

    const sql = `
      SELECT ${PUBLIC_DETAIL_COLUMNS}
      FROM offers
      WHERE ${condition}
        AND db_status = 'PUBLISHED'
        AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
      LIMIT 1
    `;

    const result = await db.query<PublicOfferDetail>(sql, [idOrUniqueId]);
    return result.rows[0] ?? null;
  }
}
