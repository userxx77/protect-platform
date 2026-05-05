# Worker and outbox recovery

## Symptoms

- Outbox `PENDING` depth grows without draining.
- Rows stuck in `PROCESSING` (worker crash, deploy kill, lease too short).
- Redis unavailable: worker cannot publish; rows stay `PROCESSING` or retry as `PENDING` after failure handler runs.

## Checks

1. **Postgres**: `SELECT status, count(*) FROM outbox_events GROUP BY status;`
2. **Oldest PENDING**: `SELECT min(created_at) FROM outbox_events WHERE status = 'PENDING';`
3. **Stale PROCESSING**: `SELECT id, processing_started_at FROM outbox_events WHERE status = 'PROCESSING' ORDER BY processing_started_at ASC LIMIT 20;`
4. **Redis**: API `GET /internal/worker/status` (JWT admin) for heartbeats and `protect:worker:instances`.

## Automatic reclaim

Workers run `reclaimStaleProcessing` before each batch: any `PROCESSING` row with `processing_started_at < now() - PROCESSING_LEASE_SEC` returns to `PENDING`.

Tune `PROCESSING_LEASE_SEC` (default 300) so normal dispatch always finishes within the lease; increase if publishes are routinely slow.

## Manual reclaim (emergency)

If workers are stopped and you need to unblock the queue:

```sql
UPDATE outbox_events
SET status = 'PENDING', processing_started_at = NULL, last_error = 'manual_reclaim'
WHERE status = 'PROCESSING';
```

Run only when no healthy worker is actively dispatching.

## Redis loss

- Worker **requires** Redis for `PUBLISH` / `XADD`. If Redis is down, dispatch fails; rows go back to `PENDING` after retry unless max attempts mark them `FAILED`.
- Restore Redis, then workers will retry `PENDING` rows (respecting `next_retry_at`).

## Postgres as source of truth

Event payloads and status are always in `outbox_events`. Redis streams and pub/sub are **delivery** channels only.

## Idempotent dispatch (crash recovery)

Each outbox row uses Redis key `protect:event:processed:{eventId}` written **in the same `MULTI/EXEC` bundle** as `PUBLISH` and `XADD`. If the worker crashes after Redis succeeds but before Postgres marks `DISPATCHED`, a retry sees the marker, **finalizes Postgres only**, and does not publish again.

## High load and backlog bursts

- **Worker:** Tune `OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_BATCH_SIZE`, `OUTBOX_POLL_MS`, `PROCESSING_LEASE_SEC` so batches drain steadily without rows stuck in `PROCESSING`.
- **API:** Set `API_OUTBOX_REJECT_THRESHOLD` (>0) so `OutboxBackpressureMiddleware` in the API (`apps/api/src/common/outbox-backpressure.middleware.ts`) returns **503** on mutating `/v1/*` when `protect:outbox:backlog_snapshot.pending` exceeds the threshold (snapshot is written by the worker). Prevents unbounded enqueue when the worker or Redis falls behind.
- **Reports:** Redis-backed rate limits (`REPORT_*`) and throttling already cap abuse; combine with horizontal worker scaling for sustained spikes.
- **DB:** Size Prisma connection pool / Postgres `max_connections` for concurrent API workers; flag/report paths take **per-user row locks** (`FOR UPDATE`), so heavy contention on a **single** user serializes; spread load is normal.

## Integration tests

Gated load-style drain: `STRESS_OUTBOX_N` (default 25, max 200), `SKIP_STRESS=true` to skip the burst test. See `apps/api/test/integration/hardening.integration.spec.ts`.
