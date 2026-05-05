# Operations, recovery, and production debugging

This runbook complements [production-deploy.md](./production-deploy.md) and [worker-recovery.md](./worker-recovery.md). It focuses on safe day‑2 operations without changing product behavior.

## Self-healing and restarts (Compose)

- **Compose policy**: all stack services use `restart: unless-stopped`, so a **VPS reboot** or process crash restarts containers automatically after dependencies pass healthchecks.
- **API**: Stateless. Restarting the API does not corrupt worker or bot; workers keep claiming Postgres rows; the bot keeps its session until the **bot** container restarts.
- **Worker**: Outbox state lives in **Postgres**. `PROCESSING` rows are **reclaimed** after `PROCESSING_LEASE_SEC` (see worker-recovery). Restarting a mid-batch worker does not double-publish successful dispatches: Redis **`protect:event:processed:{id}`** and **`processed_events`** enforce idempotency.
- **Redis restart**: Ephemeral keys (heartbeats, backlog snapshot, publish streams) rebuild; **outbox** remains in Postgres. Workers resume `PENDING` / retried rows. Brief Redis downtime can leave rows in **`PROCESSING`** until reclaim.
- **Postgres restart**: API `/ready` goes unhealthy; Compose keeps dependents waiting or restarting until DB recovers. No automatic data repair is required for the outbox schema.
- **Bot**: **discord.js** reconnects the gateway after disconnects. Logs: `discord_shard_disconnect`, `discord_shard_resume`, `discord_client_ready`. Slash commands are re-registered on each **process** start via Discord’s **`PUT`** application (and optional guild) routes — this is **idempotent** (same command set replaced, not duplicated as parallel definitions).

## Zero-downtime expectations (single VPS)

True rolling “zero downtime” needs multiple instances behind a load balancer. On a **single** VPS, expect **brief** gaps while containers restart:

- Prefer **`docker compose up -d`** (recreate) over `stop`/`start` storms.
- Restart **API** first if you are isolating a bug; worker and bot tolerate short API blips if queues and Discord stay up.
- Restart **worker** anytime for stuck batch loops; do not restart **multiple** workers simultaneously unless you accept a short drain pause.

## Debugging production state

### Unified JSON (recommended)

With a **dashboard admin JWT**:

```http
GET /internal/ops/debug
```

Response includes the same signals as `/internal/ops/overview` plus:

- `timings.postgresQueryMs`, `timings.redisPingMs`
- `worker.heartbeatObserved` and per-instance `heartbeatAgeSec` / `heartbeatStale`
- `hints` with Redis key names for cross-checks

No secrets are returned.

### Other internal reads

- `GET /internal/ops/overview` — compact health + backlog + worker snapshot.
- `GET /internal/outbox/backlog` — queue depths only.
- `GET /internal/worker/status` — Redis worker keys only.

### Host validation script

After deploy or reboot:

```bash
chmod +x validate-deployment.sh
./validate-deployment.sh
```

Checks: Compose services running, API `/health` + `/ready`, web `/api/health`, Postgres `pg_isready`, Redis `PING`, worker heartbeat key freshness, bot log line `discord_client_ready`. Exit **non‑zero** if any check fails.

Optional: set `DASHBOARD_JWT_SECRET` / obtain JWT and query `/internal/ops/debug` if the script reports a stale heartbeat.

## Safe manual recovery

| Goal | Safe approach |
|------|----------------|
| **Restart worker only** | `docker compose restart worker`. No duplicate fan-out for completed events (idempotent markers). |
| **Stuck `PROCESSING` / reclaim** | Automatic reclaim on lease expiry; manual SQL only when no healthy worker is dispatching (see [worker-recovery.md](./worker-recovery.md)). |
| **FAILED outbox → PENDING** | Use `apps/api/scripts/outbox-safe-requeue.ts` (dry-run default; `--apply` only after reviewing output). Never re-queue **`DISPATCHED`**. |
| **Cache vs Postgres drift** | `POST /internal/cache/user/:discordId/repair` then validate; prefer per-user repair over mass Redis `FLUSH`. |
| **Bot out of sync with API** | Ensure `BOT_API_KEY` and `API_BASE_URL` match; restart **bot** container; slash registration runs on startup; gateway reconnect logs should show `discord_shard_resume`. |

## Logs and noise reduction

- **API** (production): HTTP access logs **skip** `GET /health`, `/ready`, `/metrics`, and `/docs` to reduce Docker log noise (`apps/api/src/app.module.ts`).
- **Worker**: `worker_dependencies_wait`, `redis_reconnect_scheduled`, `outbox_batch_error`, `worker_shutdown_signal` use structured JSON (`timestamp`, `message`, `service`, `level` / `msg`).
- **Bot**: Connection lifecycle and slash registration retries are structured similarly (`apps/bot/src/log.ts`).

Set **`LOG_LEVEL`** (API) if you need quieter or louder Nest/pino output.

## Related

- [production-deploy.md](./production-deploy.md) — bootstrap, probes, start order.
- [worker-recovery.md](./worker-recovery.md) — outbox SQL, Redis loss, idempotency.
