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
}
