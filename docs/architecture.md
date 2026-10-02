# Lanka Offers — Backend API Architecture

## 1. Overview
The `lanka-offers-backend-api` service is the dedicated, read-only consumer data service for Lanka Offers. It is designed to be lean, secure, and resilient, serving both Mobile and Web clients with sub-100ms response times.

## 2. Responsibilities
- **Serves**: Published, active bank promotions, canonical merchant directories, bank configurations, and health telemetry.
- **Does NOT Serve**: Operational ingestion, scraping, raw HTML/PDF parsing, validation workflows, review actions, duplicate merge mutations, or LLM evaluation.

## 3. Layered Design
```
HTTP Client (Mobile App / Web App)
      │
      ▼
Express App (CORS, Correlation ID Middleware)
      │
      ▼
Routes Layer (`src/modules/*/*.routes.ts`)
      │
      ▼
Controllers (`src/modules/*/*.controller.ts`)
      │
      ▼
Services (`src/modules/*/*.service.ts`)
      │
      ▼
Repositories (`src/modules/*/*.repository.ts`)
      │
      ▼
Neon Postgres (`offers` table: read-only connection)
```

## 4. Security & Sanitization Guarantees
1. **Public Isolation**: Enforces `db_status = 'PUBLISHED'` and `(valid_to IS NULL OR valid_to >= CURRENT_DATE)` on every offer query.
2. **Explicit DTO Selection**: Database queries explicitly project public columns only. Internal fields (`llm_score`, `llm_reasoning`, `manual_override`, `pending_candidate`, `scrape_run_id`, `content_hash`) are never queried or leaked.
3. **Identifier Resiliency**: `GET /api/offers/:id` supports lookup by either UUID or `unique_id`, ensuring full compatibility with mobile navigation.
