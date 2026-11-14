import { db } from '../../infrastructure/db/db-client';
import { PAGINATION } from '../../config/constants';
import {
  NearbyOffersQueryOptions,
  OfferListQueryOptions,
  PaginatedResult,
  PublicOfferDetail,
  PublicOfferSummary,
} from './offer.types';
import { getCachedNearby, setCachedNearby } from '../../infrastructure/cache/nearby-cache';
import { buildNearbyOffersQuery } from './nearby-query';

const PUBLIC_SUMMARY_COLUMNS = `
  id, unique_id, bank, source_url, title, category, card_type,
  merchant_name, merchant_location, canonical_merchant, location_scope,
  discount_percentage, valid_from, valid_to, card_eligibility,
  geo_locations, geo_status, db_status,
  COALESCE(
    description,
    SUBSTRING(raw_offer->'offer'->>'description' FROM 1 FOR 200),
    title
  ) AS description,
  COALESCE(terms, raw_offer->'offer'->>'terms') AS terms,
  min_spend, max_discount, max_bill_value, installment_plans,
  recurrence, booking_required, booking_phone, pdf_terms_url, image_url,
  created_at, updated_at
`;

const PUBLIC_DETAIL_COLUMNS = `
  id, unique_id, bank, source_url, title, category, card_type,
  merchant_name, merchant_location, canonical_merchant, location_scope,
  discount_percentage, valid_from, valid_to, card_eligibility,
  geo_locations, geo_status, raw_offer, db_status,
  COALESCE(
    description,
    raw_offer->'offer'->>'description',
    title
  ) AS description,
  COALESCE(terms, raw_offer->'offer'->>'terms') AS terms,
  min_spend, max_discount, max_bill_value, installment_plans,
  recurrence, booking_required, booking_phone, pdf_terms_url, image_url,
  created_at, updated_at
`;

export class OfferRepository {
  public async findPublishedOffers(
    options: OfferListQueryOptions
  ): Promise<PaginatedResult<PublicOfferSummary>> {
    const conditions: string[] = [
      "db_status = 'PUBLISHED'",
      '(valid_to IS NULL OR valid_to >= CURRENT_DATE)',
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
      const merchantClean = options.merchant.trim();
      conditions.push(
        `(
          LOWER(COALESCE(canonical_merchant, merchant_name)) = LOWER($${paramIndex})
          OR LOWER(canonical_merchant) = LOWER($${paramIndex})
          OR LOWER(merchant_name) = LOWER($${paramIndex})
          OR canonical_merchant ILIKE $${paramIndex + 1}
          OR merchant_name ILIKE $${paramIndex + 1}
        )`
      );
      params.push(merchantClean, `%${merchantClean}%`);
      paramIndex += 2;
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
      ORDER BY updated_at DESC, id ASC
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

  /**
   * Nearby discovery via legacy `locations` + PostGIS GIST.
   * SQL lives in nearby-query.ts; optional Redis cache wraps the result.
   */
  public async findNearbyOffers(
    options: NearbyOffersQueryOptions
  ): Promise<PaginatedResult<PublicOfferSummary>> {
    const radius = Math.min(Math.max(options.radius ?? 25, 0.5), 100);
    const limit = Math.min(
      Math.max(options.limit ?? PAGINATION.DEFAULT_LIMIT, 1),
      PAGINATION.MAX_LIMIT
    );
    const offset = Math.max(options.offset ?? PAGINATION.DEFAULT_OFFSET, 0);

    const cacheOpts = { ...options, radius, limit, offset };
    const cached = await getCachedNearby(cacheOpts);
    if (cached) return cached;

    const { sql, params } = buildNearbyOffersQuery(options, radius, limit, offset);
    const dataRes = await db.query<PublicOfferSummary & { total_count: number }>(sql, params);

    const result: PaginatedResult<PublicOfferSummary> = {
      items: dataRes.rows.map(({ total_count: _total, ...row }) => row),
      total: dataRes.rows[0]?.total_count ?? 0,
      limit,
      offset,
    };

    await setCachedNearby(cacheOpts, result);
    return result;
  }

  public async findPublishedOfferById(idOrUniqueId: string): Promise<PublicOfferDetail | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrUniqueId);

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
