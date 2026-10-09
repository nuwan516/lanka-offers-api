import { db } from '../../database/db-client';

export interface MerchantSummaryDto {
  name: string;
  category: string | null;
  offer_count: number;
  banks: string[];
  aliases: string[];
}

export class MerchantRepository {
  public async getMerchantSummaries(): Promise<MerchantSummaryDto[]> {
    const sql = `
      SELECT
        COALESCE(canonical_merchant, merchant_name) AS name,
        category,
        COUNT(*)::int AS offer_count,
        ARRAY_AGG(DISTINCT bank ORDER BY bank) AS banks,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT merchant_name), COALESCE(canonical_merchant, merchant_name)) AS aliases
      FROM offers
      WHERE db_status = 'PUBLISHED'
        AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
        AND (merchant_name IS NOT NULL OR canonical_merchant IS NOT NULL)
      GROUP BY 1, 2
      ORDER BY offer_count DESC, name ASC
    `;

    const result = await db.query<MerchantSummaryDto>(sql);
    return result.rows;
  }

  public async getMerchantByName(name: string): Promise<MerchantSummaryDto | null> {
    const trimmed = name.trim();
    const sql = `
      SELECT
        COALESCE(canonical_merchant, merchant_name) AS name,
        category,
        COUNT(*)::int AS offer_count,
        ARRAY_AGG(DISTINCT bank ORDER BY bank) AS banks,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT merchant_name), COALESCE(canonical_merchant, merchant_name)) AS aliases
      FROM offers
      WHERE db_status = 'PUBLISHED'
        AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
        AND (
          LOWER(COALESCE(canonical_merchant, merchant_name)) = LOWER($1)
          OR LOWER(canonical_merchant) = LOWER($1)
          OR LOWER(merchant_name) = LOWER($1)
          OR canonical_merchant ILIKE ('%' || $1 || '%')
          OR merchant_name ILIKE ('%' || $1 || '%')
        )
      GROUP BY 1, 2
      ORDER BY offer_count DESC
      LIMIT 1
    `;

    const result = await db.query<MerchantSummaryDto>(sql, [trimmed]);
    return result.rows[0] ?? null;
  }
}

