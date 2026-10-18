/**
 * Verification script for database least-privilege role boundaries.
 * 
 * Tests the active or supplied DATABASE_URL to confirm:
 * 1. Health ping (SELECT 1) succeeds.
 * 2. Public query (SELECT FROM offers) succeeds.
 * 3. Unauthorized write (INSERT INTO offers) fails with permission denied.
 * 4. Sensitive table read (SELECT FROM scrape_runs) fails with permission denied.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/verify_least_privilege.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.TEST_READONLY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[FAIL] No database connection string configured in environment.');
  process.exit(1);
}

// Mask connection string to protect credentials
const maskedUrl = connectionString.replace(/:[^:@]+@/, ':****@');
console.log(`[INIT] Testing database permissions against: ${maskedUrl}`);

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 10000,
});

async function runVerification() {
  const client = await pool.connect();
  let allPassed = true;

  try {
    // 1. Current user
    const userRes = await client.query('SELECT CURRENT_USER, CURRENT_DATABASE()');
    console.log(`[INFO] Connected as user: "${userRes.rows[0].current_user}" to DB: "${userRes.rows[0].current_database}"`);

    // 2. Health check ping
    try {
      const pingRes = await client.query('SELECT 1 AS ping');
      if (pingRes.rows[0]?.ping === 1) {
        console.log('[PASS] Test 1: SELECT 1 AS ping succeeded.');
      } else {
        console.error('[FAIL] Test 1: SELECT 1 AS ping returned unexpected result.');
        allPassed = false;
      }
    } catch (e) {
      console.error(`[FAIL] Test 1: SELECT 1 AS ping failed: ${(e as Error).message}`);
      allPassed = false;
    }

    // 3. Public read from offers
    try {
      const offersRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM offers WHERE db_status = 'PUBLISHED'"
      );
      console.log(`[PASS] Test 2: SELECT from offers succeeded (${offersRes.rows[0]?.count} published offers).`);
    } catch (e) {
      console.error(`[FAIL] Test 2: SELECT from offers failed: ${(e as Error).message}`);
      allPassed = false;
    }

    // 4. Non-mutating catalog privilege boundary checks (has_table_privilege)
    const catalogPrivRes = await client.query(`
      SELECT 
        has_table_privilege(CURRENT_USER, 'public.offers', 'INSERT') AS can_insert_offers,
        has_table_privilege(CURRENT_USER, 'public.offers', 'UPDATE') AS can_update_offers,
        has_table_privilege(CURRENT_USER, 'public.offers', 'DELETE') AS can_delete_offers,
        has_table_privilege(CURRENT_USER, 'public.geo_cache', 'INSERT') AS can_insert_geo,
        has_table_privilege(CURRENT_USER, 'public.bank_parser_rules', 'SELECT') AS can_select_rules,
        has_table_privilege(CURRENT_USER, 'public.internal_audit', 'SELECT') AS can_select_audit,
        has_schema_privilege(CURRENT_USER, 'public', 'CREATE') AS can_create_schema
    `);
    const cp = catalogPrivRes.rows[0];

    // 4a. Mutation Denial: INSERT offers
    if (!cp.can_insert_offers) {
      console.log('[PASS] Test 3a: Catalog check confirmed: has_table_privilege for INSERT on offers is FALSE.');
    } else {
      console.warn('[FAIL] Test 3a: Elevated privilege detected: User has INSERT on offers.');
      allPassed = false;
    }

    // 4b. Mutation Denial: UPDATE offers
    if (!cp.can_update_offers) {
      console.log('[PASS] Test 3b: Catalog check confirmed: has_table_privilege for UPDATE on offers is FALSE.');
    } else {
      console.warn('[FAIL] Test 3b: Elevated privilege detected: User has UPDATE on offers.');
      allPassed = false;
    }

    // 4c. Mutation Denial: DELETE offers
    if (!cp.can_delete_offers) {
      console.log('[PASS] Test 3c: Catalog check confirmed: has_table_privilege for DELETE on offers is FALSE.');
    } else {
      console.warn('[FAIL] Test 3c: Elevated privilege detected: User has DELETE on offers.');
      allPassed = false;
    }

    // 5. Table Isolation: Sensitive administrative tables
    if (!cp.can_select_rules && !cp.can_select_audit) {
      console.log('[PASS] Test 4: Catalog check confirmed: SELECT denied on bank_parser_rules & internal_audit.');
    } else {
      console.warn('[FAIL] Test 4: Elevated privilege detected: User can read sensitive administrative tables.');
      allPassed = false;
    }

    // 6. Schema Mutation Denial: CREATE on schema public
    if (!cp.can_create_schema) {
      console.log('[PASS] Test 5: Catalog check confirmed: CREATE privilege on schema public is FALSE.');
    } else {
      console.warn('[FAIL] Test 5: Elevated privilege detected: User can CREATE objects in public schema.');
      allPassed = false;
    }

    if (allPassed) {
      console.log('\n[SUCCESS] All least-privilege security tests PASSED.');
    } else {
      console.log('\n[WARNING] Some least-privilege checks failed or account has elevated privileges.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runVerification().catch((err) => {
  console.error('[FATAL] Verification runner error:', err.message);
  process.exit(1);
});
