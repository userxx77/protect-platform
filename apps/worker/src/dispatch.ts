import { PrismaClient, Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import { logWorker } from './log';
import {
  buildDomainEnvelope,
  channelForEventType,
  EVENT_STREAM_KEY,
  isDomainEventType,
} from '@protect/shared';

export type OutboxRow = {
  id: string;
  type: string;
  payload: unknown;
  correlation_id: string | null;
  attempts: number;
  created_at: Date;
};

/** Reclaim rows stuck in PROCESSING after worker crash (see PROCESSING_LEASE_SEC). */
export async function reclaimStaleProcessing(
  prisma: PrismaClient,
  leaseSec: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - leaseSec * 1000);
  const r = await prisma.$executeRaw`
    UPDATE outbox_events
    SET
      status = 'PENDING'::"OutboxStatus",
      processing_started_at = NULL,
      last_error = 'reclaimed_stale_processing'
    WHERE status = 'PROCESSING'::"OutboxStatus"
      AND processing_started_at IS NOT NULL
      AND processing_started_at < ${cutoff}
  `;
  return typeof r === 'number' ? r : 0;
}

/**
 * Atomically claim eligible rows: PENDING -> PROCESSING with lease timestamp.
 * Safe for horizontal scaling (SKIP LOCKED + single-statement update).
 */
export async function claimOutboxBatch(
  prisma: PrismaClient,
  now: Date,
  take: number,
): Promise<OutboxRow[]> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    return tx.$queryRaw<OutboxRow[]>`
      WITH claimed AS (
        SELECT id
        FROM outbox_events
        WHERE status = 'PENDING'::"OutboxStatus"
          AND ("next_retry_at" IS NULL OR "next_retry_at" <= ${now})
        ORDER BY created_at ASC
        LIMIT ${take}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events o
      SET
        status = 'PROCESSING'::"OutboxStatus",
        processing_started_at = ${now},
        updated_at = ${now}
      FROM claimed c
      WHERE o.id = c.id
      RETURNING o.id, o.type, o.payload, o.correlation_id, o.attempts, o.created_at
    `;
  });
}

async function finalizeDispatched(
  prisma: PrismaClient,
  rowId: string,
): Promise<void> {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.outboxEvent.update({
      where: { id: rowId },
      data: {
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        lastError: null,
        nextRetryAt: null,
        processingStartedAt: null,
      },
    });
    await tx.processedEvent.createMany({
      data: [{ eventId: rowId }],
      skipDuplicates: true,
    });
  });
}

async function dispatchOne(
  prisma: PrismaClient,
  redis: Redis,
  row: OutboxRow,
  maxAttempts: number,
  processedTtlSec: number,
): Promise<void> {
  if (row.attempts >= maxAttempts) {
    await prisma.outboxEvent.update({
      where: { id: row.id },
      data: {
        status: 'FAILED',
        processingStartedAt: null,
        lastError: 'max_dispatch_attempts',
      },
    });
    return;
  }

  if (!isDomainEventType(row.type)) {
    await prisma.outboxEvent.update({
      where: { id: row.id },
      data: {
        status: 'FAILED',
        processingStartedAt: null,
        lastError: `unknown_event_type:${row.type}`,
      },
    });
    return;
  }

  const current = await prisma.outboxEvent.findUnique({
    where: { id: row.id },
    select: { status: true },
  });
  if (current?.status === 'DISPATCHED') {
    return;
  }

  const alreadyProcessed = await prisma.processedEvent.findUnique({
    where: { eventId: row.id },
    select: { eventId: true },
  });
  if (alreadyProcessed) {
    await finalizeDispatched(prisma, row.id);
    return;
  }

  const redisMarkerKey = `protect:event:processed:${row.id}`;
  const markerExists = await redis.get(redisMarkerKey);
  if (markerExists === '1') {
    await finalizeDispatched(prisma, row.id);
    await redis.incr('protect:worker:events_dispatched');
    logWorker('info', 'outbox_dispatch_reconciled', {
      eventId: row.id,
      type: row.type,
      correlationId: row.correlation_id,
      outboxStatus: 'DISPATCHED',
    });
    return;
  }

  try {
    const envelope = buildDomainEnvelope({
      outboxId: row.id,
      type: row.type,
      occurredAt: row.created_at,
      correlationId: row.correlation_id,
      payload: row.payload,
    });
    const json = JSON.stringify(envelope);
    const channel = channelForEventType(row.type);

    const multi = redis.multi();
    multi.publish(channel, json);
    multi.xadd(EVENT_STREAM_KEY, '*', 'envelope', json);
    multi.set(redisMarkerKey, '1', 'EX', processedTtlSec);
    const res = await multi.exec();
    if (res) {
      for (const tuple of res) {
        const err = tuple[0];
        if (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
    }

    await finalizeDispatched(prisma, row.id);

    await redis.incr('protect:worker:events_dispatched');
    logWorker('info', 'outbox_dispatched', {
      eventId: row.id,
      type: row.type,
      correlationId: row.correlation_id,
      outboxStatus: 'DISPATCHED',
    });
  } catch (e) {
    logWorker('warn', 'outbox_dispatch_failed', {
      eventId: row.id,
      type: row.type,
      correlationId: row.correlation_id,
      outboxStatus: 'PENDING',
      error: String(e).slice(0, 500),
    });
    const attemptsAfter = row.attempts + 1;
    const backoff = Math.min(
      120_000,
      500 * Math.pow(2, attemptsAfter) + Math.random() * 500,
    );
    await prisma.outboxEvent.update({
      where: { id: row.id },
      data: {
        status: attemptsAfter >= maxAttempts ? 'FAILED' : 'PENDING',
        attempts: { increment: 1 },
        lastError: String(e).slice(0, 2000),
        nextRetryAt: new Date(Date.now() + backoff),
        processingStartedAt: null,
      },
    });
  }
}

export async function publishBacklogSnapshot(
  prisma: PrismaClient,
  redis: Redis,
): Promise<void> {
  const [pending, processing, failed, oldestPending] = await prisma.$transaction([
    prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
    prisma.outboxEvent.count({ where: { status: 'PROCESSING' } }),
    prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
    prisma.outboxEvent.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  const now = Date.now();
  const lagMs = oldestPending
    ? now - oldestPending.createdAt.getTime()
    : null;

  const payload = JSON.stringify({
    pending,
    processing,
    failed,
    oldestPendingLagMs: lagMs,
    capturedAt: new Date(now).toISOString(),
  });

  await redis.set('protect:outbox:backlog_snapshot', payload, 'EX', 30);
}

export function logBacklogAlerts(
  pending: number,
  warn: number,
  critical: number,
): void {
  if (pending > critical) {
    logWorker('error', 'outbox_backlog_critical', {
      pending,
      threshold: critical,
    });
  } else if (pending > warn) {
    logWorker('warn', 'outbox_backlog_high', { pending, threshold: warn });
  }
}

export async function processOutboxBatch(
  prisma: PrismaClient,
  redis: Redis,
  opts: {
    batch: number;
    maxAttempts: number;
    processingLeaseSec: number;
    processedTtlSec: number;
    backlogWarn: number;
    backlogCritical: number;
  },
): Promise<void> {
  await reclaimStaleProcessing(prisma, opts.processingLeaseSec);
  const now = new Date();
  const rows = await claimOutboxBatch(prisma, now, opts.batch);
  for (const row of rows) {
    await dispatchOne(
      prisma,
      redis,
      row,
      opts.maxAttempts,
      opts.processedTtlSec,
    );
  }

  await publishBacklogSnapshot(prisma, redis);
  const pendingOnly = await prisma.outboxEvent.count({
    where: { status: 'PENDING' },
  });
  logBacklogAlerts(pendingOnly, opts.backlogWarn, opts.backlogCritical);
}
