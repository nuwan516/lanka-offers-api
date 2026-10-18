# Public API Least-Privilege Role Setup Guide

## Overview

The public consumer backend API (`backend-api`) serves read-only requests for published bank offers, categories, merchants, and geocoded locations. It requires **no data modification or schema alteration privileges**.

To follow the Principle of Least Privilege and protect the production database from SQL injection or lateral movement, the public API should connect via a dedicated role: `lanka_offers_public_api`.

---

## 1. Role Capabilities and Boundaries

| Database Object | Granted Privileges | Purpose |
|---|---|---|
| `neondb` (Database) | `CONNECT` | Connection establishment |
| `public` (Schema) | `USAGE` | Resolving table names |
| `public.offers` | `SELECT` | Reading published offer details |
| `public.geo_cache` | `SELECT` | Reading cached geocodes |
| All other tables (`scrape_runs`, `validation_reports`, `offer_review_history`, `external_api_usage`, etc.) | **NO ACCESS** | Internal operational data isolated |
| Any table | **NO INSERT / UPDATE / DELETE / TRUNCATE** | Zero mutation capabilities |

---

## 2. Deployment Instructions

### Step 1: Run the Idempotent Migration Script
Execute [database/security/001_create_readonly_role.sql](../database/security/001_create_readonly_role.sql) in the Neon Console SQL Editor or via `psql` using the administrative `neondb_owner` role.

> [!IMPORTANT]
> Replace `'REPLACE_WITH_STRONG_RANDOM_PASSWORD'` in the script with a cryptographically generated password (e.g. `openssl rand -base64 32`).

### Step 2: Verify Assigned Privileges
Run the verification query in [database/security/verify_role_privileges.sql](../database/security/verify_role_privileges.sql):
```sql
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'lanka_offers_public_api'
ORDER BY table_name, privilege_type;
```
Ensure only `SELECT` on `offers` and `geo_cache` appears.

### Step 3: Update `backend-api/.env`
Update the `DATABASE_URL` in `backend-api/.env` with the new role credentials:
```env
DATABASE_URL="postgresql://lanka_offers_public_api:<STRONG_PASSWORD>@ep-morning-river-b3db0zpy-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

### Step 4: Run the Privilege Verification Script
Run the automated privilege boundary verification:
```bash
cd backend-api
npx ts-node -r tsconfig-paths/register scripts/verify_least_privilege.ts
```

---

## 3. Rollback Instructions

If rollback to the default owner role is required:
1. Revert `DATABASE_URL` in `backend-api/.env` to the previous connection string.
2. Restart the API service: `pm2 restart lanka-offers-api` (production) or local server.
3. Run [database/security/rollback_readonly_role.sql](../database/security/rollback_readonly_role.sql) using `neondb_owner` to cleanly revoke permissions and drop `lanka_offers_public_api`.
