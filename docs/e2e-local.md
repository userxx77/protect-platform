# Local end-to-end runbook

This document describes how to run the full **report → Postgres/outbox → worker → Redis events → API** loop on your machine, and how to run API integration tests against real infrastructure.

## Processes

You need **four** runtime pieces (plus Postgres/Redis):

1. **Infrastructure** — `docker compose up -d postgres redis` (or your own PostgreSQL 16 + Redis 7).
2. **`apps/api`** — NestJS HTTP API (`pnpm --filter @protect/api dev`).
3. **`apps/worker`** — outbox dispatcher (`pnpm --filter @protect/worker dev` or `pnpm worker:start` after build).
4. **`apps/bot`** — Discord bot (`pnpm --filter @protect/bot dev`), using the same `BOT_API_KEY` as the API.

The dashboard (`apps/web`) is optional for this pipeline.

## Environment

- Copy `.env.example` to `.env` at the repo root (or set the same variables in each app).
- **`DATABASE_URL`** — required for API and worker (worker uses Prisma with the API schema).
- **`REDIS_URL`** — required for **worker** and for **normal API mode** (caching, report rate limits, outbox backpressure, pub/sub). The **bot** uses it only if you want live event subscription.
- **`BOT_API_KEY`** — must match on API and bot for `x-api-key` calls.
- **`DASHBOARD_JWT_SECRET`** — required for dashboard JWT routes (and for `InternalModule` admin JWT).

### `REDIS_OPTIONAL` (API only)

- Set `REDIS_OPTIONAL=true` and omit `REDIS_URL` to run the API **without** Redis.
- **`GET /v1/user/:id`** still returns data from Postgres (and bot cache-bypass reads remain valid).
- **`POST /v1/report`** returns **503** because report intake requires Redis-backed rate limits and dedupe — this is expected (“read-only safe, report intake blocked”).

## Scripted E2E check (manual)

With API, worker, and bot running against migrated DB and Redis:

1. Submit a report (bot slash command or `POST /v1/report` with the bot key).
2. Wait until the outbox drains: `GET /internal/outbox/backlog` (admin JWT) until pending is `0`, or inspect `outbox_events` in SQL.
3. Run **`/check`** (or `GET /v1/user/:target` with the bot key); the bot sends `x-protect-skip-user-cache: true` so the response reflects Postgres after worker/API updates, not a stale Redis cache entry.

## Integration tests (`apps/api`)

From the repo root (with `pnpm` available, e.g. `corepack pnpm`):

```bash
cd apps/api
set DATABASE_URL=postgres://...
set REDIS_URL=redis://...
set BOT_API_KEY=test-key
set DASHBOARD_JWT_SECRET=test-secret
pnpm exec jest --config jest.config.cjs --runInBand
```

Or use the package script:

```bash
pnpm --filter @protect/api test:integration
```

- Set **`SKIP_INTEGRATION=true`** to skip all integration suites (e.g. in environments without DB/Redis).
- **Scenario A** requires `DATABASE_URL` and `REDIS_URL`; it exercises `POST /v1/report`, drains the outbox via the same `processOutboxBatch` logic as the worker, then asserts `GET /v1/user/:id` with skip-cache.
- **Scenario B** inserts a raw `outbox_events` row and runs the worker batch without HTTP.
- **Scenario C** runs in a separate file; it temporarily sets `REDIS_OPTIONAL=true` and unsets `REDIS_URL` for a fresh app instance, then asserts user reads from DB and report `503`.
- **Hardening** (`hardening.integration.spec.ts`): concurrent reports on the same target, worker dispatch reconcile path, optional **`SKIP_STRESS=true`** to skip burst drain; **`STRESS_OUTBOX_N`** (default 25, max 200) sizes the burst test.

## Load / backlog operations

See [docs/runbooks/worker-recovery.md](runbooks/worker-recovery.md) for **`API_OUTBOX_REJECT_THRESHOLD`**, worker batch settings, and dispatch idempotency after crashes.
