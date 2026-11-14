-- =============================================================================
-- Migration: 002_grant_locations_select.sql
-- Purpose:   Grant public API role SELECT on legacy locations (nearby PostGIS)
-- Apply on:  lanka-offers (small-queen-93152447) after role exists
-- =============================================================================

GRANT SELECT ON TABLE public.locations TO lanka_offers_public_api;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.locations FROM lanka_offers_public_api;
