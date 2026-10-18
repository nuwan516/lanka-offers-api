-- =============================================================================
-- Migration: rollback_readonly_role.sql
-- Purpose: Complete database role teardown (Decommission only)
-- WARNING: Do NOT execute during routine application rollback.
-- Application rollback preserves the role and reverts code/configuration.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'lanka_offers_public_api') THEN
    -- Terminate active client connections using this role so DROP ROLE does not block
    PERFORM pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE usename = 'lanka_offers_public_api'
      AND pid <> pg_backend_pid();

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
