# Lanka Offers — Public Consumer Backend API

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-Neon-00E599.svg)](https://neon.tech/)

High-performance, read-oriented, sanitized REST service powering Lanka Offers consumer clients:
- **Lanka Offers Mobile** (Flutter Android / iOS)
- **Lanka Offers Web** (React Consumer Web)

---

## 1. What This Repository Owns
- Public read-only endpoints (`/api/offers`, `/api/offers/:id`, `/api/merchants`, `/api/banks`, `/api/health`).
- Strict consumer data sanitization: Enforces `db_status = 'PUBLISHED'` and non-expired records. Strips all internal scraping metadata, LLM evaluations, manual override audit trails, and internal hashes.
- Parameterized SQL execution behind clean repository abstractions. Zero SQL in route handlers.
- High-efficiency database connection pooling against Neon serverless PostgreSQL.
- API contract definitions and OpenAPI 3.0 specification (`src/contracts/openapi.json`).

## 2. What This Repository Explicitly Does NOT Own
- **Scraping / Crawling**: Puppeteer, Playwright, Cheerio, and bank-specific scrapers live in `lanka-offers-admin`.
- **Parsing & Ingestion**: Period date parsing, raw text extraction, and candidate generation live in `lanka-offers-admin`.
- **Data Validation & LLMs**: Gemini/DeepSeek scoring, LLM validators, and golden cases live in `lanka-offers-admin`.
- **Operational Workflow**: Offer review, approval, rejection, and manual correction UI/APIs live in `lanka-offers-admin`.
- **Schema Migrations**: Authoritative DDL and migration scripts live in `lanka-offers-admin`.

---

## 3. Architecture

```
HTTP Request
     ↓
Route Layer (`src/modules/<feature>/*.routes.ts`)
     ↓
Controller Layer (`src/modules/<feature>/*.controller.ts`)
     ↓
Service Layer (`src/modules/<feature>/*.service.ts`)
     ↓
Repository Layer (`src/modules/<feature>/*.repository.ts`)
     ↓
PostgreSQL (`src/database/db-client.ts`)
```

### Directory Structure
```
lanka-offers-backend-api/
├── src/
│   ├── app/
│   │   ├── app.ts                 # Express application factory & middleware chain
│   │   └── server.ts              # HTTP listener & graceful shutdown handlers
│   ├── config/
│   │   ├── constants.ts           # Pagination limits, defaults, cache keys
│   │   └── env.ts                 # Validated environment configuration
│   ├── contracts/
│   │   └── openapi.json           # Authoritative OpenAPI 3.0 contract definition
│   ├── database/
│   │   └── db-client.ts           # Neon PostgreSQL connection pool
│   ├── middleware/
│   │   ├── correlation-id.ts      # X-Correlation-ID tracing
│   │   └── error-handler.ts       # Structured consumer error responses
│   └── modules/
│       ├── banks/                 # Bank metadata & status
│       ├── health/                # Liveness & database connection health
│       ├── merchants/             # Merchant catalog & canonical groupings
│       └── offers/                # Sanitized consumer offers & single-offer lookup
├── tests/
│   ├── unit/                      # Unit tests for repositories & services
│   ├── integration/               # Integration tests for route controllers
│   ├── contract/                  # Cross-repository API contract tests
│   └── smoke/                     # Health check smoke tests
├── docs/
│   ├── api.md                     # Endpoint documentation & query parameters
│   ├── architecture.md            # Structural decisions & invariants
│   └── deployment.md              # Production deployment & PM2 topology
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 4. Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL database (or Neon connection string)

### Local Setup
1. Clone this repository:
   ```bash
   git clone <repo-url> lanka-offers-backend-api
   cd lanka-offers-backend-api
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The API will listen on `http://localhost:3001`.

---

## 5. Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot-reload (`ts-node`) |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm run start` | Run compiled production server |
| `npm run type-check` | Run `tsc --noEmit` to verify type safety |
| `npm test` | Run all test suites (unit, integration, contract) |
| `npm run test:unit` | Run unit tests |
| `npm run test:contract` | Run contract tests ensuring Mobile/Web schema compatibility |

---

## 6. API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service liveness & database connectivity |
| `GET` | `/api/offers` | Paginated list of published, valid offers with filtering |
| `GET` | `/api/offers/:id` | Fetch single published offer by UUID or `unique_id` |
| `GET` | `/api/merchants` | List active merchants with published offer counts |
| `GET` | `/api/banks` | List supported Sri Lankan financial institutions |

Full documentation: [docs/api.md](docs/api.md) and [src/contracts/openapi.json](src/contracts/openapi.json).
