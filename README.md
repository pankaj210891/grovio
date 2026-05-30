# Grovio

A configurable, multi-category, multi-vendor marketplace platform for physical products, built as a commercially sellable starter kit. Buyers can rebrand and reconfigure the entire marketplace for a new product vertical — grocery, furniture, electronics, party decorations, tools, home/kitchen, beauty, office, pet supplies — without rewriting core code.

## Product Suite

- **Web Storefront** — customer-facing shopping experience
- **Web Admin Panel** — category management, moderation, analytics, settings
- **Web Vendor Panel** — product management, orders, earnings, inventory
- **React Native App** — full-featured mobile customer app
- **Shared Backend** — Fastify API, PostgreSQL, Redis, OpenSearch

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | Node.js 22, TypeScript, Fastify 5, Drizzle ORM, Zod |
| Database | PostgreSQL 16 (Neon) |
| Cache / Queue | Redis (Upstash) + BullMQ |
| Search | OpenSearch (Bonsai) |
| Web Frontend | React 19, Vite 8, Tailwind CSS 4, React Query 5, Zustand 5, Framer Motion 12 |
| Mobile | React Native 0.83, Expo SDK 53, React Navigation 7 |
| Payments | Stripe, Razorpay (provider abstraction) |
| Email | Nodemailer + Google SMTP |
| Monorepo | pnpm workspaces + Turborepo |

## Prerequisites

- Node.js 22 LTS
- pnpm 9.x (`npm install -g pnpm`)
- Free accounts on Neon, Upstash, and Bonsai (see Infrastructure Setup below)

## Infrastructure Setup

Grovio uses three cloud-hosted services for all environments: local development, CI, and production. There is no Docker fallback — each buyer provisions their own free-tier accounts on these services. Setup takes approximately 10 minutes.

### 1. PostgreSQL — Neon

1. Sign up at [neon.com](https://neon.com) (free tier, no credit card required)
2. Create a new project — name it `grovio` (or any name you prefer)
3. Open **Connection Details** for the project
4. Copy the **Pooled connection string** — this is your `DATABASE_URL`
   - Format: `postgresql://user:pass@ep-xxx-pooler.neon.tech/grovio?sslmode=require`
   - The app server uses this URL for all runtime queries
5. Copy the **Direct connection string** (not the pooled one) — this is your `DATABASE_DIRECT_URL`
   - Format: `postgresql://user:pass@ep-xxx.neon.tech/grovio?sslmode=require` (no `-pooler` in the hostname)
   - Required for running `pnpm db:migrate` — Neon's pooler (PgBouncer) does not support the DDL statements that drizzle-kit uses during migrations

Add both to your `.env`:

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.neon.tech/grovio?sslmode=require
DATABASE_DIRECT_URL=postgresql://user:pass@ep-xxx.neon.tech/grovio?sslmode=require
```

> SSL is enforced automatically when the URL contains `.neon.tech` or `sslmode=require` — no extra configuration needed.

### 2. Redis — Upstash

1. Sign up at [upstash.com](https://upstash.com) (free tier, no credit card required)
2. Create a new **Redis** database — choose the region closest to your deployment
3. Open the database **Details** tab
4. Copy the **ioredis** connection string — this is your `REDIS_URL`
   - Format: `rediss://:TOKEN@your-db.upstash.io:6380`
   - The `rediss://` scheme (note the double `s`) means TLS is required — do not change it to `redis://`

Add to your `.env`:

```
REDIS_URL=rediss://:your-token@your-db.upstash.io:6380
```

> TLS is enforced automatically when the URL starts with `rediss://` — no extra configuration needed.

> **BullMQ note:** If you run BullMQ background workers (inventory expiry, email dispatch, webhook retry), use the Upstash **Fixed plan** rather than the pay-per-request plan. BullMQ polls Redis continuously even when no jobs are active, and per-command pricing accumulates rapidly under continuous polling.

### 3. OpenSearch — Bonsai

1. Sign up at [bonsai.io](https://bonsai.io) (free Sandbox tier, no credit card required)
2. Create a new cluster — select the **Sandbox** plan and the OpenSearch engine
3. Open the cluster **Access** tab
4. Copy the cluster URL including credentials — this is your `OPENSEARCH_URL`
   - Format: `https://user:pass@your-cluster.bonsai.io`
   - Credentials are embedded in the URL (standard Basic Auth format)

Add to your `.env`:

```
OPENSEARCH_URL=https://user:pass@your-cluster.bonsai.io
```

> OpenSearch is required from Phase 3 (Catalog & Search) onwards. You can leave this value as a placeholder until you reach that phase.

> **Bonsai Sandbox shard limit:** The free Sandbox tier is limited to 10 shards. OpenSearch creates 1 primary + 1 replica shard per index by default (= 2 shards per index). To stay within the 10-shard limit across multiple indexes, create each index with `"number_of_replicas": 0`. This halves shard usage with no impact on a single-node Sandbox cluster.

## Local Setup

```bash
# 1. Clone and install dependencies
git clone https://github.com/your-org/grovio.git
cd grovio
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — paste your Neon, Upstash, and Bonsai connection strings

cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — paste the same connection strings

# 3. Run database migrations
pnpm db:migrate

# 4. Start all apps in development mode
pnpm dev
```

After `pnpm dev`, the following services will be running:

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3001 |
| Web Storefront | http://localhost:5173 |
| Web Admin | http://localhost:5174 |
| Web Vendor | http://localhost:5175 |

For the React Native app:

```bash
cd apps/mobile
pnpm expo start
```

## Environment Variables

All required environment variables are documented in `.env.example` (shared infrastructure) and `apps/api/.env.example` (API-specific). Copy both files to `.env` in their respective directories and fill in the values from the Infrastructure Setup section above.

| Variable | Source | Required |
|----------|--------|----------|
| `DATABASE_URL` | Neon pooled connection string | Always |
| `DATABASE_DIRECT_URL` | Neon direct connection string | For `pnpm db:migrate` only |
| `REDIS_URL` | Upstash ioredis connection string | Always |
| `OPENSEARCH_URL` | Bonsai cluster URL with credentials | Phase 3+ |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` | Always |
| `GOOGLE_SMTP_USER` | Gmail address | Phase 8+ (email) |
| `GOOGLE_SMTP_PASS` | Gmail App Password | Phase 8+ (email) |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console | Phase 4+ (Places) |

## CI / GitHub Actions

CI reads all four cloud credentials from GitHub Actions repository secrets. Before CI can pass, add the following secrets to your repository (**Settings → Secrets and variables → Actions → New repository secret**):

- `DATABASE_URL` — Neon pooled connection string
- `DATABASE_DIRECT_URL` — Neon direct connection string
- `REDIS_URL` — Upstash connection string
- `OPENSEARCH_URL` — Bonsai cluster URL

## Rebranding

Design tokens live in `packages/ui/src/tokens/`. Change colors, fonts, and spacing there to rebrand across all three web apps simultaneously. See `docs/rebranding.md` for a step-by-step guide.

## License

See `LICENSE` for terms.
