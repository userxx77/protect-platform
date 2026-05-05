# Production deployment

Operational guide for bringing Protect up in production (Docker Compose or any orchestrator with equivalent semantics). This does not change domain behavior; it documents processes, probes, and safe recovery.

## Topology

- **Postgres**: source of truth for users, flags, reports, and **outbox events**.
- **Redis**: worker fan-out (`PUBLISH`, streams), idempotency marker `protect:event:processed:{eventId}`, worker heartbeats, API rate limits and optional caches.
- **API**: stateless HTTP; scale horizontally behind a load balancer.
- **Worker**: drains `outbox_events`; safe to scale horizontally via `FOR UPDATE SKIP LOCKED`.
- **Web**: Next.js dashboard; readiness checks server env only (no app DB).
- **Bot**: Discord gateway; optional HTTP probes after Discord `Client ready`.

## Start order (Compose)

VPS quick path:

```bash
chmod +x setup.sh
./setup.sh
```

Operator-facing overview (dashboard vs bot vs env): see **[Sentra / Protect operator guide](../sentra-operator-guide.md)**.

**Public HTTPS and domain (Caddy on the VPS):** see **[VPS domain and TLS (Caddy)](vps-domain-ssl-caddy.md)** — fix “default Caddy page”, DNS, Let’s Encrypt / Cloudflare, and `reverse_proxy` to Compose ports.

Manual path: ensure `.env` uses Docker hostnames for `DATABASE_URL` / `REDIS_URL` (see `.env.example`), then:

```bash
docker compose up -d --build
```

Ordering is enforced in [`docker-compose.yml`](../../docker-compose.yml):

1. **Postgres** and **Redis** healthy.
2. **API** healthy (`GET /ready` in container healthcheck). The API image runs **`prisma migrate deploy`** on startup with retries ([`apps/api/docker-entrypoint.sh`](../../apps/api/docker-entrypoint.sh)) then starts Nest.
3. **Worker** after API is ready.
4. **Bot** after API is ready (bot also polls `/ready` before slash registration).
5. **Web** after API is ready and the bot container has started (`depends_on`).

## Health and readiness

| Service | Liveness | Readiness / notes |
|--------|----------|-------------------|
| API | `GET /health` | `GET /ready` — **503** if DB or (non-optional) Redis fails. If `REDIS_OPTIONAL=true` and Redis is not configured, Redis is not required for readiness. |
| Web | `GET /api/health` | `GET /api/ready` — **503** if any of `AUTH_SECRET`, `API_BASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` is missing. |
| Worker | Optional `GET http://127.0.0.1:$WORKER_HEALTH_PORT/health` | Same port `/ready` — cheap in-process check (no Postgres on each probe). |
| Bot | Optional `GET http://127.0.0.1:$BOT_HEALTH_PORT/health` after Discord ready | Align orchestrator probes with Discord connection lifecycle. |

**Kubernetes**: point `livenessProbe` at liveness URLs and `readinessProbe` at readiness URLs; use the same paths as above.

## Operator overview

With a **dashboard admin JWT**, call:

- `GET /internal/ops/overview` — aggregated `ready` probes (condensed), outbox backlog, worker Redis status, and build **`version`** from `GIT_SHA` or `npm_package_version`.
- `GET /internal/ops/debug` — same signals plus DB/Redis timing, worker heartbeat age/stale flags, and operator hints (see [operations-and-recovery.md](./operations-and-recovery.md)).

Route is excluded from the `v1` prefix like other internal endpoints (see `apps/api/src/main.ts`).

## Configuration

- **API**: `DATABASE_URL` required. `REDIS_URL` required unless `REDIS_OPTIONAL=true`. In **production**, `BOT_API_KEY` and `DASHBOARD_JWT_SECRET` are required (validated at bootstrap).
- **Worker**: `DATABASE_URL` and `REDIS_URL` required (fail-fast).
- **Shared secrets**: same `BOT_API_KEY` and JWT secrets across replicated API/Web instances; same Postgres and Redis URLs.

## Scaling

### Multiple API instances

- Stateless; sticky sessions not required.
- Nest **throttler** is in-memory per instance — effective rate limits are **per instance**, not global. Plan capacity or add a shared limiter if you need strict global caps.
- Correlation: bot sets `x-request-id` and `x-correlation-id` on outbound API calls.

### Multiple workers

- Safe: batch claim uses `FOR UPDATE SKIP LOCKED` on `PENDING` rows. See [worker-recovery.md](./worker-recovery.md) for backlog and reclaim behavior.

### Multiple bots

- Discord: use **separate tokens** and/or official sharding; do not run the same token twice.
- Parallel subscribers: use `BOT_EVENT_DEDUPE` (env) so duplicate Pub/Sub deliveries do not double-invalidate caches.

### Redis

- Single logical Redis (or clustered deployment your client supports). Streams and Pub/Sub channels are shared across workers and the API.

## Redis outage

- **Postgres outbox** retains all events; **no loss of enqueue** from the API perspective.
- **Worker** needs Redis to publish; dispatch fails and rows return to `PENDING` / `FAILED` per retry policy (see worker-recovery).
- **API** with `REDIS_OPTIONAL=true` may stay “ready” for DB-centric operations; paths that require Redis may still fail.
- **Bot** subscriber cannot refresh caches from Redis until Redis returns; guild traffic may use stale server config until repair.

**Recovery**: restore Redis, confirm worker heartbeats via `GET /internal/worker/status` or ops overview, watch `PENDING` drain.

## Cache rebuild

- Per user: `POST /internal/cache/user/:discordId/repair` (admin JWT), then `GET .../validate` if needed.
- Prefer **repair per user** over mass key deletes; invalidation patterns are operationally risky if documented incorrectly.
- For bulk repair, script a loop over Discord IDs calling the existing repair endpoint or an internal script that invokes the same service code — avoid new HTTP surfaces unless required.

## Outbox replay safety

- **Re-dispatching `DISPATCHED` rows is unsafe** (duplicate fan-out).
- **Safe**: reclaim stuck `PROCESSING` and normal `PENDING` / `FAILED` handling per [worker-recovery.md](./worker-recovery.md).

### Safe re-queue CLI (FAILED → PENDING)

For rows in **`FAILED`** only, when you are sure Redis nor `processed_events` recorded success:

- **Dry-run (default)**:

  ```bash
  cd apps/api
  DATABASE_URL=... REDIS_URL=... pnpm exec tsx scripts/outbox-safe-requeue.ts
  ```

- **Apply**:

  ```bash
  pnpm exec tsx scripts/outbox-safe-requeue.ts --apply
  ```

Optional: `--last-error SUBSTR`, `--min-age-hours N`, `--limit N`.

The tool **skips** any id where `processed_events` contains the outbox id or Redis `protect:event:processed:{id}` is set.

Package script: `pnpm --filter @protect/api run ops:outbox-safe-requeue --`.

## Manual worker restart

- **Compose**: `docker compose ... restart worker` or `up -d --force-recreate worker`.
- **Kubernetes**: rolling restart the worker `Deployment`.

No special single-leader worker: new processes join via Redis instance set and claim batches independently.

## Memory on small VPS (e.g. 8&nbsp;GB RAM)

Postgres, Redis, API, worker, bot, and web together can fit comfortably on 8&nbsp;GB if heaps are bounded and you monitor usage.

- **Node heap**: in Compose or systemd, set per service, for example `NODE_OPTIONS=--max-old-space-size=512` (API may use `768` if needed). This caps runaway memory without fixing normal traffic spikes.
- **Observe**: `docker stats` (or `htop`) after deploy; if a single container grows steadily, inspect logs and heap dumps rather than raising the limit blindly.
- **Postgres**: keep `shared_buffers` roughly within ~25% of RAM on dedicated DB hosts; on an all-in-one VPS, the default Docker Postgres image is often acceptable — tune only after measuring.

## Related

- [worker-recovery.md](./worker-recovery.md) — backlog, reclaim, idempotent dispatch, Redis loss.
- [operations-and-recovery.md](./operations-and-recovery.md) — production debugging (`GET /internal/ops/debug`), `validate-deployment.sh`, restarts, self-healing behavior.
