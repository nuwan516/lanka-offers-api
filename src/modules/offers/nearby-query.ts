/**
 * Legacy-production nearby SQL builder.
 *
 * Schema assumption (lanka-offers / small-queen-93152447):
 * - Uses public.locations.geography + GIST (locations_geography_idx)
 * - Filters offers via is_in_production / status (not db_status)
 * - Maps legacy columns to PublicOfferSummary response aliases
 *
 * Does not require rewrite tables: offer_branches, geo_locations JSONB, db_status.
 */

import { NearbyOffersQueryOptions } from './offer.types';

export interface NearbyQueryBuildResult {
  sql: string;
  params: unknown[];
}

export function buildNearbyOffersQuery(
  options: NearbyOffersQueryOptions,
  radius: number,
  limit: number,
  offset: number
): NearbyQueryBuildResult {
  const conditions: string[] = [
    'o.is_in_production = true',
    "o.status = 'active'",
    '(o.valid_to IS NULL OR o.valid_to >= CURRENT_DATE)',
    'l.success = true',
    'l.geography IS NOT NULL',
    // GIST-assisted proximity in metres. geography is spheroid-safe (poles / large radii).
    'ST_DWithin(l.geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3 * 1000.0)',
  ];

  // includeNationwide retained for API compatibility; legacy has no location_scope.
  void options.includeNationwide;

  const params: unknown[] = [options.lat, options.lng, radius];
  let paramIndex = 4;

  if (options.bank) {
    conditions.push(`LOWER(o.source) = $${paramIndex++}`);
    params.push(options.bank.toLowerCase());
  }

  if (options.category) {
    conditions.push(`o.category ILIKE $${paramIndex++}`);
    params.push(options.category);
  }

  if (options.search) {
    conditions.push(`(o.title ILIKE $${paramIndex} OR o.merchant_name ILIKE $${paramIndex})`);
    params.push(`%${options.search}%`);
    paramIndex++;
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
      WITH matched_locations AS (
        SELECT
          o.id,
          o.unique_id,
          LOWER(o.source) AS bank,
          NULL::text AS source_url,
          o.title,
          o.category,
          o.card_type,
          o.merchant_name,
          NULL::text AS merchant_location,
          o.merchant_name AS canonical_merchant,
          CASE
            WHEN l.location_type = 'CHAIN' THEN 'MULTIPLE_BRANCHES'
            WHEN l.location_type = 'SINGLE' THEN 'EXPLICIT_BRANCH'
            ELSE NULL
          END AS location_scope,
          CASE
            WHEN o.discount_percentage IS NULL THEN NULL
            ELSE trim(to_char(o.discount_percentage, 'FM999999999.999999'))
          END AS discount_percentage,
          o.valid_from::date::text AS valid_from,
          o.valid_to::date::text AS valid_to,
          jsonb_build_object(
            'cardTypes', COALESCE(to_jsonb(o.applicable_cards), '[]'::jsonb),
            'networks', '[]'::jsonb,
            'includedCards', '[]'::jsonb,
            'excludedCards', '[]'::jsonb,
            'restrictions', COALESCE(to_jsonb(o.key_restrictions), '[]'::jsonb)
          ) AS card_eligibility,
          'resolved'::text AS geo_status,
          'PUBLISHED'::text AS db_status,
          NULL::text AS image_url,
          COALESCE(o.discount_description, o.title) AS description,
          o.booking_required,
          CASE
            WHEN o.contact_phone IS NOT NULL AND cardinality(o.contact_phone) > 0
            THEN o.contact_phone[1]
            ELSE NULL
          END AS booking_phone,
          o.created_at,
          o.updated_at,
          l.branch_name,
          COALESCE(l.formatted_address, l.search_address) AS branch_address,
          l.latitude AS matched_lat,
          l.longitude AS matched_lng,
          (ST_Distance(l.geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000.0) AS dist_km
        FROM locations l
        INNER JOIN offers o ON o.id = l.offer_id
        ${whereSql}
      ),
      nearest_per_offer AS (
        SELECT DISTINCT ON (id)
          id, unique_id, bank, source_url, title, category, card_type,
          merchant_name, merchant_location, canonical_merchant, location_scope,
          discount_percentage, valid_from, valid_to, card_eligibility,
          geo_status, db_status, image_url, description, booking_required, booking_phone,
          created_at, updated_at,
          ROUND(dist_km::numeric, 1)::float AS distance_km,
          branch_name AS matched_branch_name,
          branch_address AS matched_branch_address,
          matched_lat,
          matched_lng
        FROM matched_locations
        ORDER BY id, dist_km ASC
      ),
      with_geo AS (
        SELECT
          n.*,
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'name', loc.branch_name,
                'address', COALESCE(loc.formatted_address, loc.search_address),
                'lat', loc.latitude,
                'lng', loc.longitude
              )
              ORDER BY loc.created_at
            )
            FROM locations loc
            WHERE loc.offer_id = n.id
              AND loc.success = true
              AND loc.latitude IS NOT NULL
              AND loc.longitude IS NOT NULL
          ), '[]'::jsonb) AS geo_locations,
          COUNT(*) OVER()::int AS total_count
        FROM nearest_per_offer n
      )
      SELECT
        id, unique_id, bank, source_url, title, category, card_type,
        merchant_name, merchant_location, canonical_merchant, location_scope,
        discount_percentage, valid_from, valid_to, card_eligibility,
        geo_locations, geo_status, db_status, image_url, description,
        booking_required, booking_phone, created_at, updated_at,
        distance_km, matched_branch_name, matched_branch_address, total_count
      FROM with_geo
      ORDER BY distance_km ASC, id ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

  return { sql, params: [...params, limit, offset] };
}
