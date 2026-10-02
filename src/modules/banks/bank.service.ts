import { BankMetadata, SUPPORTED_BANKS } from '../../config/constants';
import { db } from '../../database/db-client';

export interface BankWithStats extends BankMetadata {
  activeOfferCount: number;
}

export class BankService {
  public async getBanks(): Promise<BankWithStats[]> {
    const countsSql = `
      SELECT bank, COUNT(*)::int AS count
      FROM offers
      WHERE db_status = 'PUBLISHED'
        AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
      GROUP BY bank
    `;

    try {
      const countsRes = await db.query<{ bank: string; count: number }>(countsSql);
      const countsMap = new Map(countsRes.rows.map((r) => [r.bank.toLowerCase(), r.count]));

      return SUPPORTED_BANKS.map((b) => ({
        ...b,
        activeOfferCount: countsMap.get(b.code.toLowerCase()) ?? 0,
      }));
    } catch {
      // Fallback without dynamic counts if DB call fails
      return SUPPORTED_BANKS.map((b) => ({
        ...b,
        activeOfferCount: 0,
      }));
    }
  }
}
