import { db } from '../../database/db-client';
import { PAGINATION } from '../../config/constants';
import {
  OfferListQueryOptions,
  PaginatedResult,
  PublicOfferDetail,
  PublicOfferSummary,
} from './offer.types';

const PUBLIC_SUMMARY_COLUMNS = `
  id, unique_id, bank, source_url, title, category, card_type,
  merchant_name, merchant_location, canonical_merchant, location_scope,
  discount_percentage, valid_from, valid_to, card_eligibility,
  geo_locations, geo_status, db_status, created_at, updated_at
`;

const PUBLIC_DETAIL_COLUMNS = `
  id, unique_id, bank, source_url, title, category, card_type,
  merchant_name, merchant_location, canonical_merchant, location_scope,
  discount_percentage, valid_from, valid_to, card_eligibility,
  geo_locations, geo_status, raw_offer, db_status, created_at, updated_at
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

  public async findPublishedOfferById(idOrUniqueId: string): Promise<PublicOfferDetail | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrUniqueId);
    
    const condition = isUuid
      ? '(id = $1 OR unique_id = $1)'
      : 'unique_id = $1';

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
