import { OfferRepository } from '../../src/modules/offers/offer.repository';
import { db } from '../../src/database/db-client';

jest.mock('../../src/database/db-client', () => ({
  db: {
    query: jest.fn(),
  },
}));

describe('OfferRepository Unit Tests', () => {
  let repository: OfferRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new OfferRepository();
  });

  describe('findPublishedOffers', () => {
    it('should build a parameterized query enforcing PUBLISHED status and non-expired dates', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: '1', title: 'Test Offer' }] }) // data query
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }); // count query

      const result = await repository.findPublishedOffers({
        bank: 'hnb',
        category: 'dining',
        search: 'keells',
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);

      // Verify data query parameters
      const firstCallArgs = (db.query as jest.Mock).mock.calls[0];
      const sql = firstCallArgs[0];
      const params = firstCallArgs[1];

      expect(sql).toContain("db_status = 'PUBLISHED'");
      expect(sql).toContain("(valid_to IS NULL OR valid_to >= CURRENT_DATE)");
      expect(sql).toContain("bank = $1");
      expect(sql).toContain("category ILIKE $2");
      expect(sql).toContain("LIMIT $4 OFFSET $5");
      expect(params).toEqual(['hnb', 'dining', '%keells%', 10, 0]);
    });

    it('should cap limit at maximum allowed pagination boundary', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await repository.findPublishedOffers({ limit: 1000, offset: -5 });

      const firstCallArgs = (db.query as jest.Mock).mock.calls[0];
      const params = firstCallArgs[1];
      // Limit capped at MAX_LIMIT (500), offset clamped at 0
      expect(params[params.length - 2]).toBe(500);
      expect(params[params.length - 1]).toBe(0);
    });
  });

  describe('findNearbyOffers', () => {
    it('should query unnested geo_locations with Haversine distance and order by distance_km ASC', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'offer-1', title: 'Nearby Offer', distance_km: 1.2 }] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await repository.findNearbyOffers({
        lat: 6.9271,
        lng: 79.8612,
        radius: 15,
        bank: 'hnb',
        category: 'dining',
        search: 'keells',
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].distance_km).toBe(1.2);

      const firstCallArgs = (db.query as jest.Mock).mock.calls[0];
      const sql = firstCallArgs[0];
      const params = firstCallArgs[1];

      expect(sql).toContain('6371 * acos');
      expect(sql).toContain('ORDER BY distance_km ASC');
      expect(sql).toContain('o.bank = $4');
      expect(sql).toContain('o.category ILIKE $5');
      expect(params).toEqual([6.9271, 79.8612, 15, 'hnb', 'dining', '%keells%', 10, 0]);
    });
  });

  describe('findPublishedOfferById', () => {
    it('should query both id and unique_id when given a valid UUID', async () => {
      const mockUuid = '12345678-1234-1234-1234-123456789abc';
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockUuid, unique_id: 'sampath-123', title: 'Sample' }],
      });

      const offer = await repository.findPublishedOfferById(mockUuid);

      expect(offer).not.toBeNull();
      const callArgs = (db.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('id = $1');
      expect(callArgs[1]).toEqual([mockUuid]);
    });

    it('should query only unique_id when given a string identifier that is not a UUID', async () => {
      const nonUuid = 'boc-dining-2026';
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'some-uuid', unique_id: nonUuid, title: 'Sample' }],
      });

      const offer = await repository.findPublishedOfferById(nonUuid);

      expect(offer).not.toBeNull();
      const callArgs = (db.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('unique_id = $1');
      expect(callArgs[1]).toEqual([nonUuid]);
    });
  });
});

