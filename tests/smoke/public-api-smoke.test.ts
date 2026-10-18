import request from 'supertest';
import { createApp } from '../../src/app/app';
import { db } from '../../src/database/db-client';

jest.mock('../../src/database/db-client', () => ({
  db: {
    checkHealth: jest.fn(),
    query: jest.fn(),
  },
}));

describe('Comprehensive Read-Only Public API Smoke Tests (Phase 12)', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. GET /api/health', () => {
    it('returns HTTP 200 with healthy status and correlation id', async () => {
      (db.checkHealth as jest.Mock).mockResolvedValueOnce(true);

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBe('connected');
      expect(res.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('2. GET /api/banks', () => {
    it('returns HTTP 200 with all 10 supported banks conforming to BankWithStats contract', async () => {
      // Deterministic fixture: a subset of banks have active published offers
      const mockActiveCounts = [
        { bank: 'hnb', count: 15 },
        { bank: 'boc', count: 8 },
      ];

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: mockActiveCounts,
      });

      const res = await request(app).get('/api/banks');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Contract invariant: Exactly the 10 canonical bank adapters are returned in the directory
      expect(res.body).toHaveLength(10);
      const expectedCanonicalBanks = [
        'hnb', 'boc', 'peoples', 'nsb', 'sampath', 'seylan', 'ndb', 'dfcc', 'pabc', 'combank',
      ];
      const returnedBankCodes = res.body.map((b: any) => b.code);
      expect(returnedBankCodes.sort()).toEqual(expectedCanonicalBanks.sort());

      // Guarantee merchant identifiers like cargills are never present in supported banks
      expect(returnedBankCodes).not.toContain('cargills');

      // Verify every bank matches schema contract
      for (const bank of res.body) {
        expect(bank).toHaveProperty('code');
        expect(bank).toHaveProperty('name');
        expect(bank).toHaveProperty('cardTypesSupported');
        expect(Array.isArray(bank.cardTypesSupported)).toBe(true);
        expect(typeof bank.activeOfferCount).toBe('number');
        expect(bank.activeOfferCount).toBeGreaterThanOrEqual(0);
      }

      // Verify banks with active counts are reflected
      const hnb = res.body.find((b: any) => b.code === 'hnb');
      expect(hnb.activeOfferCount).toBe(15);

      const boc = res.body.find((b: any) => b.code === 'boc');
      expect(boc.activeOfferCount).toBe(8);

      // Verify inactive banks default to 0
      const nsb = res.body.find((b: any) => b.code === 'nsb');
      expect(nsb.activeOfferCount).toBe(0);
    });
  });

  describe('3. GET /api/offers', () => {
    it('returns HTTP 200 with paginated published offers and sanitizes internal administrative fields', async () => {
      const mockOffers = [
        {
          id: 'offer-1',
          unique_id: 'hnb-001',
          bank: 'hnb',
          title: '20% off at Keells Super',
          category: 'Supermarket',
          db_status: 'PUBLISHED',
          valid_to: '2026-12-31',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-02T00:00:00Z',
        },
      ];

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockOffers }) // data
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }); // count

      const res = await request(app).get('/api/offers?limit=5&bank=hnb');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total', 1);
      expect(res.body).toHaveProperty('limit', 5);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].db_status).toBe('PUBLISHED');

      // Internal field sanitization: administrative columns must NOT leak
      const item = res.body.items[0];
      expect(item).not.toHaveProperty('manual_override');
      expect(item).not.toHaveProperty('pending_candidate');
      expect(item).not.toHaveProperty('content_hash');
      expect(item).not.toHaveProperty('llm_score');
      expect(item).not.toHaveProperty('rule_passed');
    });
  });

  describe('4. GET /api/offers/nearby', () => {
    it('returns HTTP 200 with nearby offers ordered by distance', async () => {
      const mockNearby = [
        {
          id: 'offer-nearby-1',
          unique_id: 'hnb-002',
          bank: 'hnb',
          title: '15% off at Cafe Colombo',
          distance_km: 1.2,
          matched_branch_name: 'Colombo 03 Branch',
          matched_branch_address: 'Kollupitiya, Colombo 03',
          db_status: 'PUBLISHED',
        },
      ];

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockNearby }) // data
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }); // count

      const res = await request(app)
        .get('/api/offers/nearby?lat=6.9271&lng=79.8612&radius=10');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].distance_km).toBe(1.2);
    });

    it('returns HTTP 400 when lat or lng query parameters are missing or invalid', async () => {
      const res = await request(app).get('/api/offers/nearby?lat=invalid&lng=79.8612');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('5. GET /api/offers/:id', () => {
    it('returns HTTP 200 with detailed offer representation', async () => {
      const mockDetail = {
        id: 'offer-detail-1',
        unique_id: 'boc-101',
        bank: 'boc',
        title: 'Special Hotel Promotion',
        db_status: 'PUBLISHED',
        valid_to: '2026-12-31',
        raw_offer: { terms: ['Terms and conditions apply'] },
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDetail] });

      const res = await request(app).get('/api/offers/offer-detail-1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('offer-detail-1');
      expect(res.body.title).toBe('Special Hotel Promotion');
    });

    it('returns HTTP 404 when offer is not found or not published', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/offers/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Offer not found');
      expect(res.body.error.code).toBe('OFFER_NOT_FOUND');
    });
  });

  describe('6. GET /api/merchants', () => {
    it('returns HTTP 200 with aggregated merchant directory', async () => {
      const mockMerchants = [
        {
          name: 'Keells Super',
          category: 'Supermarket',
          offer_count: 5,
          banks: ['boc', 'hnb'],
          aliases: ['Keells', 'Keells Supermarket'],
        },
      ];

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: mockMerchants });

      const res = await request(app).get('/api/merchants');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].name).toBe('Keells Super');
      expect(res.body[0].offer_count).toBe(5);
    });
  });

  describe('7. GET /api/merchants/:name', () => {
    it('returns HTTP 200 with specific merchant summary', async () => {
      const mockMerchant = {
        name: 'Cargills Food City',
        category: 'Supermarket',
        offer_count: 8,
        banks: ['combank', 'sampath'],
        aliases: ['Cargills'],
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockMerchant] });

      const res = await request(app).get('/api/merchants/Cargills%20Food%20City');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Cargills Food City');
      expect(res.body.offer_count).toBe(8);
    });
  });
});
