-- =============================================================================
-- Verification: verify_role_privileges.sql
-- Purpose: Inspect and verify table-level privileges for lanka_offers_public_api
-- =============================================================================

SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'lanka_offers_public_api'
ORDER BY table_name, privilege_type;

-- Expected output:
-- grantee                 | table_schema | table_name | privilege_type
-- ------------------------+--------------+------------+----------------
-- lanka_offers_public_api | public       | geo_cache  | SELECT
-- lanka_offers_public_api | public       | offers     | SELECT
--
-- Notice: NO INSERT, UPDATE, DELETE, or TRUNCATE privileges should be present.
-- Notice: NO access to scrape_runs, offer_review_history, validation_reports, etc.
