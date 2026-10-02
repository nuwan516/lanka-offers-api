# Deployment Guide — Lanka Offers Public Backend API

## Overview
`lanka-offers-backend-api` is the consumer-facing REST API providing read-only offer, merchant, and bank discovery data to Lanka Offers Mobile (Flutter) and Lanka Offers Web applications.

It is designed to run statelessly as a standalone Node.js service behind an SSL reverse proxy (e.g., Nginx, Caddy, or Cloudflare).

---

## Production Deployment Topology

```
                  Internet (HTTPS)
                         │
                         ▼
             [ Nginx / Reverse Proxy ]
               api.lanka-offers.me:443
                         │
                         ▼ (HTTP reverse proxy)
               [ Node.js PM2 Process ]
                    localhost:3001
                         │
                         ▼ (TLS Pooled Connection)
            [ Neon Serverless PostgreSQL ]
```

---

## Environment Configuration

Create a production `.env` file in the deployment root (ensure permissions are `600` and it is NOT tracked by Git):

```bash
PORT=3001
NODE_ENV=production
DATABASE_URL="postgres://user:password@ep-something.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
CORS_ORIGINS="https://lanka-offers.me,https://www.lanka-offers.me"
LOG_LEVEL=info
```

### Required Variables
| Variable | Description | Example |
|---|---|---|
| `PORT` | Local port to bind the HTTP server | `3001` |
| `NODE_ENV` | Runtime environment (`production` or `development`) | `production` |
| `DATABASE_URL` | Neon PostgreSQL pooled connection string | `postgres://...@ep-...neon.tech/neondb?sslmode=require` |
| `CORS_ORIGINS` | Comma-delimited list of allowed web origins | `https://lanka-offers.me` |
| `LOG_LEVEL` | Minimum log severity level | `info` |

---

## Build & Run Steps

### 1. Install Production Dependencies
```bash
npm ci --only=production
```

### 2. Compile TypeScript
```bash
npm run build
```
This outputs compiled JavaScript to `dist/`.

### 3. Process Management via PM2
Use PM2 to ensure high availability, automatic restarts, and clustering:

```bash
# Start or reload via PM2
pm2 start dist/app/server.js --name "lanka-offers-public-api" -i max
pm2 save
```

### 4. Health Check Verification
Immediately verify that the service is running and connected to PostgreSQL:

```bash
curl -f http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-10-03T...",
  "version": "1.0.0"
}
```

---

## Zero-Downtime Rollback Procedure

If a deployed version exhibits anomalies:
1. Revert to the previous build directory or git tag.
2. Run `pm2 reload lanka-offers-public-api`.
3. Verify `/api/health` returns HTTP 200 within 5 seconds.
