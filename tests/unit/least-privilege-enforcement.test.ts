import { OfferRepository } from '../../src/modules/offers/offer.repository';
import { MerchantRepository } from '../../src/modules/merchants/merchant.repository';
import { BankService } from '../../src/modules/banks/bank.service';
import { db } from '../../src/infrastructure/db/db-client';

jest.mock('../../src/infrastructure/db/db-client', () => ({
  db: {
    query: jest.fn(),
    checkHealth: jest.fn(),
  },
}));

describe('Least Privilege & Query Boundary Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Public API repositories issue exclusively read-only SELECT queries', () => {
    it('OfferRepository.findPublishedOffers should only issue SELECT queries', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: '1', title: 'Offer' }] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const repo = new OfferRepository();
      await repo.findPublishedOffers({ limit: 10, offset: 0 });

      const calls = (db.query as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);

      for (const call of calls) {
        const sql = (call[0] as string).trim();
        expect(sql.toUpperCase().startsWith('SELECT')).toBe(true);
        expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
        expect(sql).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
        expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
        expect(sql).not.toMatch(/\bDROP\s+/i);
        expect(sql).not.toMatch(/\bTRUNCATE\b/i);
      }
    });

    it('MerchantRepository should only issue SELECT queries', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const repo = new MerchantRepository();
      await repo.getMerchantSummaries();

      const calls = (db.query as jest.Mock).mock.calls;
      expect(calls.length).toBe(1);
      const sql = (calls[0][0] as string).trim();
      expect(sql.toUpperCase().startsWith('SELECT')).toBe(true);
      expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(sql).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    });

    it('BankService should only issue SELECT queries on published offers', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ bank: 'hnb', count: 10 }] });

      const service = new BankService();
      await service.getBanks();

      const calls = (db.query as jest.Mock).mock.calls;
      expect(calls.length).toBe(1);
      const sql = (calls[0][0] as string).trim();
      expect(sql.toUpperCase().startsWith('SELECT')).toBe(true);
      expect(sql).toMatch(/db_status\s*=\s*'PUBLISHED'/i);
      expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(sql).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    });
  });

  describe('Database permission enforcement error handling', () => {
    it('should cleanly throw on database permission denied errors (code 42501)', async () => {
      const permissionError = new Error('permission denied for table scrape_runs');
      Object.assign(permissionError, { code: '42501' });

      (db.query as jest.Mock).mockRejectedValueOnce(permissionError);

      const repo = new OfferRepository();
      await expect(repo.findPublishedOffers({})).rejects.toThrow('permission denied');
    });
  });
});
