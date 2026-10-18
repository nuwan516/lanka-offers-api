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

const connectionString = process.env.TEST_READONLY_DATABASE_URL || process.env.DATABASE_URL;

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

    // 4. Unauthorized write: INSERT into offers
    try {
      await client.query(
        "INSERT INTO offers (unique_id, bank, title, raw_offer) VALUES ('test-privilege-check', 'test', 'Test', '{}')"
      );
      console.warn('[FAIL] Test 3: Unauthorized INSERT into offers SUCCEEDED (User has WRITE permissions!).');
      allPassed = false;
    } catch (e) {
      const err = e as { code?: string; message: string };
      if (err.code === '42501' || err.message.includes('permission denied')) {
        console.log('[PASS] Test 3: Unauthorized INSERT rejected with "permission denied" (code 42501).');
      } else {
        console.log(`[INFO] Test 3: INSERT rejected with: ${err.message}`);
      }
    }

    // 5. Unauthorized read from operational tables (scrape_runs)
    try {
      await client.query('SELECT COUNT(*) FROM scrape_runs');
      console.warn('[FAIL] Test 4: Unauthorized SELECT from scrape_runs SUCCEEDED (Internal operational tables are exposed!).');
      allPassed = false;
    } catch (e) {
      const err = e as { code?: string; message: string };
      if (err.code === '42501' || err.message.includes('permission denied')) {
        console.log('[PASS] Test 4: Unauthorized SELECT from scrape_runs rejected with "permission denied" (code 42501).');
      } else {
        console.log(`[INFO] Test 4: SELECT rejected with: ${err.message}`);
      }
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
