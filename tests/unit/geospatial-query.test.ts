import { OfferRepository } from '../../src/modules/offers/offer.repository';
import { db } from '../../src/infrastructure/db/db-client';

jest.mock('../../src/infrastructure/db/db-client', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/infrastructure/cache/nearby-cache', () => ({
  getCachedNearby: jest.fn().mockResolvedValue(null),
  setCachedNearby: jest.fn().mockResolvedValue(undefined),
}));

describe('Geospatial Query Correctness (legacy locations + PostGIS GIST)', () => {
  let repository: OfferRepository;

  beforeEach(() => {
    repository = new OfferRepository();
    jest.clearAllMocks();
  });

  describe('A1: PostGIS ST_DWithin on locations.geography', () => {
    it('uses ST_DWithin on locations.geography and does not use offer_branches / Haversine / bbox', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await repository.findNearbyOffers({
        lat: 6.9271,
        lng: 79.8612,
        radius: 20,
      });

      const [dataCall] = (db.query as jest.Mock).mock.calls;
      const sql = dataCall[0] as string;

      expect(sql).toContain('ST_DWithin(l.geography');
      expect(sql).toContain('ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography');
      expect(sql).toContain('$3 * 1000.0');
      expect(sql).toContain('FROM locations l');
      expect(sql).toContain('o.is_in_production = true');
      expect(sql).toContain("o.status = 'active'");
      expect(sql).not.toContain('offer_branches');
      expect(sql).not.toContain('6371 * acos');
      expect(sql).not.toContain('jsonb_array_elements');
      expect(sql).not.toContain('branch_lat BETWEEN ($1 - ($3 / 111.0))');
      // Response aliases db_status='PUBLISHED'; filter uses legacy is_in_production.
      expect(sql).not.toContain('o.db_status');
      expect(sql).toContain("'PUBLISHED'::text AS db_status");
    });
  });

  describe('A2: Shared list+count CTE', () => {
    it('returns total via COUNT(*) OVER in a single query', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'offer-1', distance_km: 1.2, total_count: 3 }],
      });

      const result = await repository.findNearbyOffers({
        lat: 7.2906,
        lng: 80.6337,
        radius: 10,
      });

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(1);
      expect((result.items[0] as { total_count?: number }).total_count).toBeUndefined();

      const sql = (db.query as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('COUNT(*) OVER()::int AS total_count');
    });
  });

  describe('A3: Multi-branch handling & filters', () => {
    it('uses DISTINCT ON (id) for nearest location and preserves matched branch fields', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'offer-keells-1',
            unique_id: 'combank-keells-super',
            title: '20% off at Keells Super',
            distance_km: 0.8,
            matched_branch_name: 'Keells Colombo 3',
            matched_branch_address: 'Galle Road, Kollupitiya',
            total_count: 1,
          },
        ],
      });

      const result = await repository.findNearbyOffers({
        lat: 6.9147,
        lng: 79.854,
        radius: 5,
      });

      expect(result.items[0].matched_branch_name).toBe('Keells Colombo 3');
      expect(result.items[0].matched_branch_address).toBe('Galle Road, Kollupitiya');

      const dataSql = (db.query as jest.Mock).mock.calls[0][0] as string;
      expect(dataSql).toContain('DISTINCT ON (id)');
      expect(dataSql).toContain('ORDER BY id, dist_km ASC');
      expect(dataSql).toContain('branch_name AS matched_branch_name');
      expect(dataSql).toContain('ORDER BY distance_km ASC, id ASC');
    });

    it('filters bank via LOWER(offers.source) for legacy uppercase bank codes', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await repository.findNearbyOffers({
        lat: 6.9271,
        lng: 79.8612,
        bank: 'hnb',
      });

      const [sql, params] = (db.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('LOWER(o.source) = $4');
      expect(params).toEqual([6.9271, 79.8612, 25, 'hnb', 50, 0]);
    });

    it('does not reference rewrite location_scope filters (legacy has none)', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await repository.findNearbyOffers({
        lat: 6.0535,
        lng: 80.221,
        radius: 25,
        includeNationwide: false,
      });

      const dataSql = (db.query as jest.Mock).mock.calls[0][0] as string;
      expect(dataSql).not.toContain('o.location_scope NOT IN');
      expect(dataSql).not.toContain("'NATIONWIDE'");
    });

    it('relies on geography spheroid math (no polar cos clamp)', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await repository.findNearbyOffers({
        lat: 89.5,
        lng: 0.0,
        radius: 50,
      });

      const dataSql = (db.query as jest.Mock).mock.calls[0][0] as string;
      expect(dataSql).not.toContain('least(89.0, greatest(-89.0, $1))');
      expect(dataSql).toContain('ST_DWithin');
      expect(dataSql).toContain('l.geography');
    });
  });
});
