-- =============================================================================
-- Rollback: rollback_readonly_role.sql
-- Purpose: Safely revoke permissions and drop lanka_offers_public_api role
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'lanka_offers_public_api') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM lanka_offers_public_api;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM lanka_offers_public_api;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM lanka_offers_public_api;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM lanka_offers_public_api;
    REVOKE USAGE ON SCHEMA public FROM lanka_offers_public_api;
    REVOKE CONNECT ON DATABASE neondb FROM lanka_offers_public_api;
    DROP ROLE lanka_offers_public_api;
  END IF;
END
$$;
