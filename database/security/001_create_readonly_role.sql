-- =============================================================================
-- Migration: 001_create_readonly_role.sql
-- Subsystem: Lanka Offers Public Consumer Backend API
-- Purpose:   Create least-privilege PostgreSQL role for public consumer queries
-- Target DB: Neon Lakebase PostgreSQL (neondb)
-- =============================================================================

-- Step 1: Idempotently create the role if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lanka_offers_public_api') THEN
    -- Password must be replaced with a secure secret before running in production
    CREATE ROLE lanka_offers_public_api WITH
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      CONNECTION LIMIT 50
      PASSWORD 'REPLACE_WITH_STRONG_RANDOM_PASSWORD';
  END IF;
END
$$;

-- Step 2: Grant connection and schema usage
GRANT CONNECT ON DATABASE neondb TO lanka_offers_public_api;
GRANT USAGE ON SCHEMA public TO lanka_offers_public_api;

-- Step 3: Revoke all default table permissions in public schema
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM lanka_offers_public_api;

-- Step 4: Grant SELECT ONLY on tables required by public API endpoints
-- (Derived directly from queries in OfferRepository, MerchantRepository, BankService)
GRANT SELECT ON TABLE public.offers TO lanka_offers_public_api;
GRANT SELECT ON TABLE public.geo_cache TO lanka_offers_public_api;

-- Step 5: Explicitly deny any mutation permissions (defense in depth)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER 
  ON ALL TABLES IN SCHEMA public FROM lanka_offers_public_api;

-- Step 6: Ensure future tables created by migrations do not automatically grant access
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  REVOKE ALL ON TABLES FROM lanka_offers_public_api;

-- Step 7: Restrict execution of user-defined functions/routines in public schema
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM lanka_offers_public_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  REVOKE EXECUTE ON ROUTINES FROM lanka_offers_public_api;
