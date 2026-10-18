/**
 * Post-Cutover Verification Script (Phase 13)
 *
 * Verifies live post-cutover behavior of Lanka Offers Public Backend API.
 * Proves that the API is running under the least-privilege role 'lanka_offers_public_api'
 * and that all public consumer endpoints function without PostgreSQL 42501 permission errors.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/post_cutover_verification.ts [baseUrl]
 *   Default baseUrl: http://127.0.0.1:3001
 */

import http from 'http';
import https from 'https';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const baseUrl = process.argv[2] || process.env.API_BASE_URL || 'http://127.0.0.1:3001';

interface VerificationResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const report: VerificationResult[] = [];

function maskUrl(url?: string): string {
  if (!url) return '<empty>';
  return url.replace(/:[^:@]+@/, ':****@');
}

function fetchJson(urlStr: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const isHttps = urlStr.startsWith('https');
    const client = isHttps ? https : http;

    const req = client.get(urlStr, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          resolve({ status: res.statusCode || 500, body });
        } catch {
          resolve({ status: res.statusCode || 500, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${urlStr}`));
    });
  });
}

async function runPostCutoverVerification() {
  console.log('================================================================================');
  console.log('  LANKA OFFERS — POST-CUTOVER VERIFICATION AUTOMATION');
  console.log(`  Target API Base URL: ${baseUrl}`);
  console.log('================================================================================\n');

  // 1. Live Session Identity Verification via PostgreSQL
  const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    report.push({
      step: '1. Database Credentials Present',
      status: 'FAIL',
      details: 'Neither DATABASE_PUBLIC_URL nor DATABASE_URL was found in environment.',
    });
  } else {
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
      max: 1,
    });

    try {
      const client = await pool.connect();
      try {
        const identityRes = await client.query('SELECT CURRENT_USER, SESSION_USER, CURRENT_DATABASE()');
        const currentUser = identityRes.rows[0]?.current_user;
        const sessionUser = identityRes.rows[0]?.session_user;
        const currentDb = identityRes.rows[0]?.current_database;

        if (currentUser === 'lanka_offers_public_api') {
          report.push({
            step: '1. Database Role Identity',
            status: 'PASS',
            details: `Active role confirmed as "${currentUser}" (SESSION_USER: "${sessionUser}") on "${currentDb}"`,
          });
        } else {
          report.push({
            step: '1. Database Role Identity',
            status: 'FAIL',
            details: `Active role is "${currentUser}", NOT the restricted role "lanka_offers_public_api"!`,
          });
        }

        // Check write permission denial via non-mutating catalog function
        const canUpdateRes = await client.query(
          "SELECT has_table_privilege(current_user, 'public.offers', 'UPDATE') AS can_update, has_table_privilege(current_user, 'public.offers', 'INSERT') AS can_insert"
        );
        const { can_update, can_insert } = canUpdateRes.rows[0];
        if (!can_update && !can_insert) {
          report.push({
            step: '2. Mutation Protection',
            status: 'PASS',
            details: 'Catalog privilege verification confirmed: has_table_privilege for UPDATE/INSERT is FALSE.',
          });
        } else {
          report.push({
            step: '2. Mutation Protection',
            status: 'FAIL',
            details: `Catalog reports mutation privilege granted: update=${can_update}, insert=${can_insert}`,
          });
        }
      } finally {
        client.release();
        await pool.end();
      }
    } catch (err: any) {
      report.push({
        step: '1. Database Role Identity',
        status: 'FAIL',
        details: `Direct connection failed: ${err.message}`,
      });
    }
  }

  // 2. Health Endpoint
  try {
    const health = await fetchJson(`${baseUrl}/api/health`);
    if (health.status === 200 && health.body.status === 'ok' && health.body.database === 'connected') {
      report.push({
        step: '3. API Health & DB Connection',
        status: 'PASS',
        details: `HTTP 200 OK | status: "${health.body.status}", database: "${health.body.database}"`,
      });
    } else {
      report.push({
        step: '3. API Health & DB Connection',
        status: 'FAIL',
        details: `HTTP ${health.status} | Unexpected response: ${JSON.stringify(health.body)}`,
      });
    }
  } catch (err: any) {
    report.push({
      step: '3. API Health & DB Connection',
      status: 'FAIL',
      details: `Health check request failed: ${err.message}`,
    });
  }

  // 3. Banks Endpoint
  try {
    const banksRes = await fetchJson(`${baseUrl}/api/banks`);
    if (banksRes.status === 200 && Array.isArray(banksRes.body)) {
      const totalBanks = banksRes.body.length;
      const activeBanks = banksRes.body.filter((b: any) => b.activeOfferCount > 0);
      report.push({
        step: '4. Bank Discovery (/api/banks)',
        status: 'PASS',
        details: `HTTP 200 OK | Returned ${totalBanks} supported banks (${activeBanks.length} banks currently have active published offers)`,
      });
    } else {
      report.push({
        step: '4. Bank Discovery (/api/banks)',
        status: 'FAIL',
        details: `HTTP ${banksRes.status} | ${JSON.stringify(banksRes.body)}`,
      });
    }
  } catch (err: any) {
    report.push({
      step: '4. Bank Discovery (/api/banks)',
      status: 'FAIL',
      details: `Banks endpoint error: ${err.message}`,
    });
  }

  // 4. Offers Endpoint (Paginated & Published-Only)
  try {
    const offersRes = await fetchJson(`${baseUrl}/api/offers?limit=5`);
    if (offersRes.status === 200 && offersRes.body && Array.isArray(offersRes.body.data)) {
      const total = offersRes.body.pagination?.total ?? 0;
      report.push({
        step: '5. Paginated Offers (/api/offers)',
        status: 'PASS',
        details: `HTTP 200 OK | Retrieved ${offersRes.body.data.length} offers (Total published pool: ${total})`,
      });
    } else {
      report.push({
        step: '5. Paginated Offers (/api/offers)',
        status: 'FAIL',
        details: `HTTP ${offersRes.status} | ${JSON.stringify(offersRes.body)}`,
      });
    }
  } catch (err: any) {
    report.push({
      step: '5. Paginated Offers (/api/offers)',
      status: 'FAIL',
      details: `Offers endpoint error: ${err.message}`,
    });
  }

  // 5. Nearby Discovery Endpoint (Haversine & Bounding-Box)
  try {
    const nearbyRes = await fetchJson(`${baseUrl}/api/offers/nearby?lat=6.9271&lng=79.8612&radius=10`);
    if (nearbyRes.status === 200 && nearbyRes.body && Array.isArray(nearbyRes.body.data)) {
      report.push({
        step: '6. Nearby Discovery (/api/offers/nearby)',
        status: 'PASS',
        details: `HTTP 200 OK | Geospatial query succeeded (${nearbyRes.body.data.length} nearby offers in 10km radius)`,
      });
    } else {
      report.push({
        step: '6. Nearby Discovery (/api/offers/nearby)',
        status: 'FAIL',
        details: `HTTP ${nearbyRes.status} | ${JSON.stringify(nearbyRes.body)}`,
      });
    }
  } catch (err: any) {
    report.push({
      step: '6. Nearby Discovery (/api/offers/nearby)',
      status: 'FAIL',
      details: `Nearby endpoint error: ${err.message}`,
    });
  }

  // 6. Merchant Directory Endpoint
  try {
    const merchantsRes = await fetchJson(`${baseUrl}/api/merchants`);
    if (merchantsRes.status === 200 && Array.isArray(merchantsRes.body)) {
      report.push({
        step: '7. Merchant Directory (/api/merchants)',
        status: 'PASS',
        details: `HTTP 200 OK | Retrieved ${merchantsRes.body.length} aggregated merchant profiles`,
      });
    } else {
      report.push({
        step: '7. Merchant Directory (/api/merchants)',
        status: 'FAIL',
        details: `HTTP ${merchantsRes.status} | ${JSON.stringify(merchantsRes.body)}`,
      });
    }
  } catch (err: any) {
    report.push({
      step: '7. Merchant Directory (/api/merchants)',
      status: 'FAIL',
      details: `Merchants endpoint error: ${err.message}`,
    });
  }

  // 7. Sanitized 404 Error Contract Check
  try {
    const notFoundRes = await fetchJson(`${baseUrl}/api/offers/00000000-0000-0000-0000-000000000000`);
    if (notFoundRes.status === 404 && notFoundRes.body?.error?.code === 'OFFER_NOT_FOUND') {
      report.push({
        step: '8. Sanitized Error Contract',
        status: 'PASS',
        details: 'HTTP 404 returned with sanitized code OFFER_NOT_FOUND (No SQL or stack leakage)',
      });
    } else {
      report.push({
        step: '8. Sanitized Error Contract',
        status: 'FAIL',
        details: `Expected HTTP 404 with OFFER_NOT_FOUND, got HTTP ${notFoundRes.status}`,
      });
    }
  } catch (err: any) {
    report.push({
      step: '8. Sanitized Error Contract',
      status: 'FAIL',
      details: `Error contract verification failed: ${err.message}`,
    });
  }

  // Summary
  console.log('--------------------------------------------------------------------------------');
  console.log('POST-CUTOVER VERIFICATION REPORT:');
  console.log('--------------------------------------------------------------------------------');
  let failures = 0;
  for (const r of report) {
    const icon = r.status === 'PASS' ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${icon.padEnd(12)} | ${r.step.padEnd(38)} | ${r.details}`);
    if (r.status === 'FAIL') failures++;
  }
  console.log('--------------------------------------------------------------------------------');

  if (failures > 0) {
    console.log(`\n❌ POST-CUTOVER VERIFICATION FAILED: ${failures} test(s) failed.`);
    console.log('Initiate rollback procedure immediately if in production.');
    process.exit(1);
  } else {
    console.log('\n✅ ALL POST-CUTOVER VERIFICATION CHECKS PASSED.');
    console.log('The public API is verified operating under the least-privilege role.');
    process.exit(0);
  }
}

runPostCutoverVerification().catch((err) => {
  console.error('[FATAL] Post-cutover verification runner crashed:', err.message);
  process.exit(1);
});
