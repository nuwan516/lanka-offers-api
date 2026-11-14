import {
  buildNearbyCacheKey,
  roundCoordForCache,
} from '../../src/infrastructure/cache/nearby-cache';

describe('Nearby Redis cache key helpers', () => {
  it('rounds coordinates to ~100m precision (3 decimal places)', () => {
    expect(roundCoordForCache(6.9271786)).toBe(6.927);
    expect(roundCoordForCache(79.861243)).toBe(79.861);
  });

  it('builds a stable key from rounded coords, radius, and filters', () => {
    const key = buildNearbyCacheKey({
      lat: 6.9271786,
      lng: 79.861243,
      radius: 15.0,
      bank: 'HNB',
      category: 'Dining',
      search: 'Keells',
      includeNationwide: false,
      limit: 50,
      offset: 0,
    });

    expect(key).toContain('nearby:v');
    expect(key).toContain('6.927');
    expect(key).toContain('79.861');
    expect(key).toContain('r15');
    expect(key).toContain('bhnb');
    expect(key).toContain('cdining');
    expect(key).toContain('skeells');
    expect(key).toContain('n0');
    expect(key).toContain('l50');
    expect(key).toContain('o0');
  });

  it('collapses nearby lat/lng values within ~100m into the same key segment', () => {
    const a = buildNearbyCacheKey({
      lat: 6.9271,
      lng: 79.8612,
      radius: 10,
      limit: 20,
      offset: 0,
    });
    const b = buildNearbyCacheKey({
      lat: 6.92719,
      lng: 79.86124,
      radius: 10,
      limit: 20,
      offset: 0,
    });
    expect(a).toBe(b);
  });
});
