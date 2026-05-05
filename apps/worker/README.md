# Protect worker

Stateful **process**, stateless **logic**: all durable state lives in Postgres (`outbox_events`, domain tables) and Redis (fan-out, locks, snapshots). Run **N** replicas for throughput; claiming uses `SKIP LOCKED` plus `PROCESSING` status.

## Configuration (high level)

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Postgres (required) |
| `REDIS_URL` | Redis (required for publish/fan-out) |
| `OUTBOX_POLL_MS` | Base poll interval |
| `OUTBOX_BATCH_SIZE` / `OUTBOX_MAX_BATCH_SIZE` | Claim batch |
| `OUTBOX_MIN_IDLE_MS` | Extra idle between passes |
| `OUTBOX_MAX_ATTEMPTS` | Move row to `FAILED` after this many dispatch failures |
| `PROCESSING_LEASE_SEC` | Stale `PROCESSING` rows older than this are reset to `PENDING` (crash recovery) |
| `PROCESSED_EVENT_TTL_SEC` | Redis `protect:event:processed:{eventId}` TTL after successful publish |
| `OUTBOX_BACKLOG_WARN` / `OUTBOX_BACKLOG_CRITICAL` | Structured log thresholds |
| `WORKER_INSTANCE_ID` | Heartbeat key suffix (default: hostname) |

## Horizontal scaling

1. Multiple workers call **claim**: `UPDATE … SET status = PROCESSING … FROM (SELECT … FOR UPDATE SKIP LOCKED)`.
2. Only one worker updates a given row to `PROCESSING`.
3. After publish, row becomes `DISPATCHED`; on failure it returns to `PENDING` with backoff or `FAILED` after max attempts.

## Crash recovery

If a worker dies after setting `PROCESSING` but before `DISPATCHED`, the next pass (any worker) runs **reclaim**: rows in `PROCESSING` with `processing_started_at` older than `PROCESSING_LEASE_SEC` are set back to `PENDING`.

See [worker recovery runbook](../../docs/runbooks/worker-recovery.md).

## Build

From repo root:

```bash
cd apps/worker && npm install && npm run build
```

Prisma client is generated from `apps/api/prisma/schema.prisma` (`prebuild`).
