-- =============================================================================
-- Verification: verify_role_privileges.sql
-- Subsystem:    Lanka Offers Public Consumer Backend API
-- Purpose:      100% Read-Only Catalog Privilege Verification for lanka_offers_public_api
-- Target DB:    Neon Lakebase PostgreSQL (neondb)
-- Safety:       NON-MUTATING. Uses has_*_privilege catalog functions.
-- =============================================================================

-- Section 1: Detailed Table Grants via information_schema
SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'lanka_offers_public_api'
ORDER BY table_name, privilege_type;

-- Section 2: Definitive Catalog Privilege Compliance Matrix
-- Evaluates explicit role grants AND implicit PUBLIC inheritance
SELECT
  'database: ' || current_database() AS resource,
  'CONNECT' AS privilege,
  has_database_privilege('lanka_offers_public_api', current_database(), 'CONNECT') AS granted,
  true AS expected,
  CASE WHEN has_database_privilege('lanka_offers_public_api', current_database(), 'CONNECT') = true THEN 'PASS' ELSE 'FAIL' END AS compliance
UNION ALL
SELECT
  'database: ' || current_database(),
  'CREATE',
  has_database_privilege('lanka_offers_public_api', current_database(), 'CREATE'),
  false,
  CASE WHEN has_database_privilege('lanka_offers_public_api', current_database(), 'CREATE') = false THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'database: ' || current_database(),
  'TEMP (inherited via PUBLIC)',
  has_database_privilege('lanka_offers_public_api', current_database(), 'TEMP'),
  true,
  'INFO (PUBLIC grant)'
UNION ALL
SELECT
  'schema: public',
  'USAGE',
  has_schema_privilege('lanka_offers_public_api', 'public', 'USAGE'),
  true,
  CASE WHEN has_schema_privilege('lanka_offers_public_api', 'public', 'USAGE') = true THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'schema: public',
  'CREATE',
  has_schema_privilege('lanka_offers_public_api', 'public', 'CREATE'),
  false,
  CASE WHEN has_schema_privilege('lanka_offers_public_api', 'public', 'CREATE') = false THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'table: public.offers',
  'SELECT',
  has_table_privilege('lanka_offers_public_api', 'public.offers', 'SELECT'),
  true,
  CASE WHEN has_table_privilege('lanka_offers_public_api', 'public.offers', 'SELECT') = true THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'table: public.offers',
  'INSERT',
  has_table_privilege('lanka_offers_public_api', 'public.offers', 'INSERT'),
  false,
  CASE WHEN has_table_privilege('lanka_offers_public_api', 'public.offers', 'INSERT') = false THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'table: public.offers',
  'UPDATE',
  has_table_privilege('lanka_offers_public_api', 'public.offers', 'UPDATE'),
  false,
  CASE WHEN has_table_privilege('lanka_offers_public_api', 'public.offers', 'UPDATE') = false THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'table: public.offers',
  'DELETE',
  has_table_privilege('lanka_offers_public_api', 'public.offers', 'DELETE'),
  false,
  CASE WHEN has_table_privilege('lanka_offers_public_api', 'public.offers', 'DELETE') = false THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'table: public.geo_cache',
  'SELECT',
  has_table_privilege('lanka_offers_public_api', 'public.geo_cache', 'SELECT'),
  true,
  CASE WHEN has_table_privilege('lanka_offers_public_api', 'public.geo_cache', 'SELECT') = true THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'table: public.geo_cache',
  'INSERT',
  has_table_privilege('lanka_offers_public_api', 'public.geo_cache', 'INSERT'),
  false,
  CASE WHEN has_table_privilege('lanka_offers_public_api', 'public.geo_cache', 'INSERT') = false THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'table: public.bank_parser_rules',
  'SELECT',
  has_table_privilege('lanka_offers_public_api', 'public.bank_parser_rules', 'SELECT'),
  false,
  CASE WHEN has_table_privilege('lanka_offers_public_api', 'public.bank_parser_rules', 'SELECT') = false THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'table: public.scraper_jobs',
  'SELECT',
  has_table_privilege('lanka_offers_public_api', 'public.scraper_jobs', 'SELECT'),
  false,
  CASE WHEN has_table_privilege('lanka_offers_public_api', 'public.scraper_jobs', 'SELECT') = false THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT
  'table: public.internal_audit',
  'SELECT',
  has_table_privilege('lanka_offers_public_api', 'public.internal_audit', 'SELECT'),
  false,
  CASE WHEN has_table_privilege('lanka_offers_public_api', 'public.internal_audit', 'SELECT') = false THEN 'PASS' ELSE 'FAIL' END;
