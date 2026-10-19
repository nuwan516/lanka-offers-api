import { OfferRepository } from '../../src/modules/offers/offer.repository';
import { db } from '../../src/infrastructure/db/db-client';

jest.mock('../../src/infrastructure/db/db-client', () => ({
  db: {
    query: jest.fn(),
  },
}));

describe('Geospatial Query Correctness & Robustness (Batch A)', () => {
  let repository: OfferRepository;

  beforeEach(() => {
    repository = new OfferRepository();
    jest.clearAllMocks();
  });

  describe('A1: Bounding-box and Latitude/Longitude Calculations', () => {
    it('uses mathematically correct cosine-scaled longitude bounding box to prevent exclusion at non-equatorial latitudes', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await repository.findNearbyOffers({
        lat: 6.9271, // Colombo latitude
        lng: 79.8612,
        radius: 20,
      });

      const [dataCall] = (db.query as jest.Mock).mock.calls;
      const sql = dataCall[0];

      // Verifies latitude delta uses 111.0 km/deg
      expect(sql).toContain('branch_lat BETWEEN ($1 - ($3 / 111.0)) AND ($1 + ($3 / 111.0))');

      // Verifies longitude delta dynamically scales by cosine of latitude with clamp to avoid division by zero
      expect(sql).toContain(
        'branch_lng BETWEEN ($2 - ($3 / (111.0 * greatest(0.01, cos(radians(least(89.0, greatest(-89.0, $1))))))))'
      );
      expect(sql).toContain(
        'AND ($2 + ($3 / (111.0 * greatest(0.01, cos(radians(least(89.0, greatest(-89.0, $1))))))))'
      );
    });
  });

  describe('A2: SQL Casting Safety & Malformed Coordinate Defense', () => {
    it('guards lat and lng parsing using sequential CASE statements and strict regex to prevent planner casting errors', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await repository.findNearbyOffers({
        lat: 7.2906, // Kandy latitude
        lng: 80.6337,
        radius: 10,
      });

      const [dataCall, countCall] = (db.query as jest.Mock).mock.calls;
      const dataSql = dataCall[0];
      const countSql = countCall[0];

      // Both dataSql and countSql must guard against non-object loc elements
      expect(dataSql).toContain("jsonb_typeof(loc) = 'object'");
      expect(countSql).toContain("jsonb_typeof(loc) = 'object'");

      // Regex must only allow 1 to 3 integer digits, preventing huge number overflows like 1e500
      expect(dataSql).toContain("(loc->>'lat') ~ '^-?[0-9]{1,3}(\\.[0-9]+)?$'");
      expect(dataSql).toContain("(loc->>'lng') ~ '^-?[0-9]{1,3}(\\.[0-9]+)?$'");

      // Verify coordinate range guards
      expect(dataSql).toContain('branch_lat BETWEEN -90.0 AND 90.0');
      expect(dataSql).toContain('branch_lng BETWEEN -180.0 AND 180.0');

      // Verify array type check on geo_locations
      expect(dataSql).toContain("jsonb_typeof(o.geo_locations) = 'array'");
    });
  });

  describe('A3: Multi-branch Distance Handling & Deterministic Output', () => {
    it('uses DISTINCT ON (id) to select the single closest branch and preserves branch name and address', async () => {
      const mockRows = [
        {
          id: 'offer-keells-1',
          unique_id: 'combank-keells-super',
          title: '20% off at Keells Super',
          distance_km: 0.8,
          matched_branch_name: 'Keells Colombo 3',
          matched_branch_address: 'Galle Road, Kollupitiya',
        },
      ];

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockRows })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await repository.findNearbyOffers({
        lat: 6.9147,
        lng: 79.8540,
        radius: 5,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('offer-keells-1');
      expect(result.items[0].distance_km).toBe(0.8);
      expect(result.items[0].matched_branch_name).toBe('Keells Colombo 3');
      expect(result.items[0].matched_branch_address).toBe('Galle Road, Kollupitiya');

      const dataSql = (db.query as jest.Mock).mock.calls[0][0];

      // DISTINCT ON (id) ensures each offer appears only once, picking nearest branch
      expect(dataSql).toContain('DISTINCT ON (id)');
      expect(dataSql).toContain('ORDER BY id, dist_km ASC');

      // Matched branch properties extracted
      expect(dataSql).toContain('branch_name AS matched_branch_name');
      expect(dataSql).toContain('branch_address AS matched_branch_address');

      // Final sorting has deterministic tie-breaker (distance_km ASC, id ASC)
      expect(dataSql).toContain('ORDER BY distance_km ASC, id ASC');
    });

    it('enforces exclusion of ONLINE and UNRESOLVED offers from nearby physical discovery', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await repository.findNearbyOffers({
        lat: 6.0535, // Galle latitude
        lng: 80.2210,
        radius: 25,
        includeNationwide: false,
      });

      const dataSql = (db.query as jest.Mock).mock.calls[0][0];
      expect(dataSql).toContain("o.location_scope NOT IN ('ONLINE', 'UNRESOLVED', 'NATIONWIDE')");
    });

    it('safely clamps latitude between -89.0 and 89.0 degrees to prevent division by zero near poles (E1)', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await repository.findNearbyOffers({
        lat: 89.5, // Extreme high latitude edge case
        lng: 0.0,
        radius: 50,
      });

      const dataSql = (db.query as jest.Mock).mock.calls[0][0];
      expect(dataSql).toContain('least(89.0, greatest(-89.0, $1))');
      expect(dataSql).toContain('greatest(0.01, cos(radians(least(89.0, greatest(-89.0, $1)))))');
    });
  });
});
