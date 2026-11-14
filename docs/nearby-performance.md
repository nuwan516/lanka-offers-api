# Nearby Offers — Performance Design (Legacy Production)

## Schema assumption

Nearby runs against the **legacy** Neon project `lanka-offers` (`small-queen-93152447`), not the rewrite schema.

| Production has | Rewrite nearby does **not** use / create |
|---|---|
| `locations` (lat/lng/`geography`) | `offer_branches` |
| GIST `locations_geography_idx` | `offers.geom` |
| `offers.is_in_production`, `offers.status` | `offers.db_status` |
| `offers.source` (HNB, BOC, …) | `offers.bank` |
| PostGIS extension | `offers.geo_locations` JSONB |

Do **not** create `offer_branches` or migrate JSONB `geo_locations` onto production for nearby.

## Query design

| Concern | Approach |
|---|---|
| Spatial filter | `ST_DWithin(locations.geography, …)` → uses GIST |
| Distance | `ST_Distance(…)/1000` as `distance_km` |
| Multi-branch offers | `DISTINCT ON (offer.id)` nearest location |
| List + count | Shared CTE + `COUNT(*) OVER()` |
| Cache | Optional Redis; key ≈ 100m-rounded lat/lng + radius + filters; TTL ~7m |
| Poles / large radii | `geography` spheroid (no Haversine / bbox) |

## Column mapping (response contract unchanged)

| API field | Legacy source |
|---|---|
| `bank` | `LOWER(offers.source)` |
| `db_status` | literal `'PUBLISHED'` when `is_in_production AND status='active'` |
| `geo_locations[]` | aggregated from `locations` rows |
| `matched_branch_*` | nearest `locations.branch_name` / address |
| `discount_percentage` | `offers.discount_percentage` cast to text |
| `location_scope` | `SINGLE`→`EXPLICIT_BRANCH`, `CHAIN`→`MULTIPLE_BRANCHES` |

`includeNationwide` is accepted for API compatibility but is a **no-op** on legacy (no `location_scope` column). Offers without successful geography rows never appear in nearby.

## Privileges

Public/read role needs `SELECT` on:

- `public.offers`
- `public.locations`

See `database/security/002_grant_locations_select.sql` and `001_create_readonly_role.sql`.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_PUBLIC_URL` / `DATABASE_URL` | Neon connection (must see `locations`) |
| `REDIS_URL` | Optional nearby response cache |
| `NEARBY_CACHE_TTL_SECONDS` | Default `420` |
| `NEARBY_CACHE_VERSION` | Soft cache flush |

## How to test

```bash
cd backend-api && npm test -- --testPathPattern="unit/(offer-query|geospatial|nearby-cache)"

curl "http://localhost:3001/api/offers/nearby?lat=6.9271&lng=79.8612&radius=10"

# Expect Bitmap Index Scan on locations_geography_idx
EXPLAIN (ANALYZE, BUFFERS)
SELECT 1 FROM locations l
WHERE ST_DWithin(
  l.geography,
  ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326)::geography,
  10000
);
```
