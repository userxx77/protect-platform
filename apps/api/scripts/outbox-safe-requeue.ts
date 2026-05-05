/**
 * Safe re-queue of FAILED outbox rows to PENDING when duplicate fan-out is ruled out.
 * Default: dry-run. Use --apply to write.
 *
 * Skips if `processed_events` has the id or Redis `protect:event:processed:{id}` is set.
 *
 * Usage (from apps/api, env in shell or .env loaded by your runner):
 *   pnpm exec tsx scripts/outbox-safe-requeue.ts [--apply] [--last-error SUBSTR] [--min-age-hours N] [--limit N]
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

function parseArgs() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  let lastErrorSubstr: string | undefined;
  let minAgeHours: number | undefined;
  let limit = 500;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--last-error' && argv[i + 1]) {
      lastErrorSubstr = argv[++i];
    } else if (a === '--min-age-hours' && argv[i + 1]) {
      minAgeHours = Number(argv[++i]);
    } else if (a === '--limit' && argv[i + 1]) {
      limit = Math.max(1, Math.min(10_000, Number(argv[++i])));
    }
  }

  return { apply, lastErrorSubstr, minAgeHours, limit };
}

function summarize(out: Array<{ action: string }>): Record<string, number> {
  const s: Record<string, number> = {};
  for (const r of out) {
    s[r.action] = (s[r.action] ?? 0) + 1;
  }
  return s;
}

async function main() {
  const { apply, lastErrorSubstr, minAgeHours, limit } = parseArgs();
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'REDIS_URL required for safe re-queue guards',
      }),
    );
    process.exit(1);
  }

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  try {
    const where: Prisma.OutboxEventWhereInput = {
      status: 'FAILED',
    };
    if (lastErrorSubstr) {
      where.lastError = {
        contains: lastErrorSubstr,
        mode: 'insensitive',
      };
    }
    if (minAgeHours != null && Number.isFinite(minAgeHours) && minAgeHours > 0) {
      where.updatedAt = {
        lt: new Date(Date.now() - minAgeHours * 3600_000),
      };
    }

    const rows = await prisma.outboxEvent.findMany({
      where,
      select: {
        id: true,
        type: true,
        attempts: true,
        lastError: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    const out: Array<{
      id: string;
      action: 'skip' | 'would_requeue' | 'requeued';
      reason?: string;
    }> = [];

    for (const row of rows) {
      const processed = await prisma.processedEvent.findUnique({
        where: { eventId: row.id },
      });
      if (processed) {
        out.push({ id: row.id, action: 'skip', reason: 'processed_events' });
        continue;
      }

      const marker = await redis.get(`protect:event:processed:${row.id}`);
      if (marker === '1') {
        out.push({
          id: row.id,
          action: 'skip',
          reason: 'redis_processed_marker',
        });
        continue;
      }

      if (!apply) {
        out.push({ id: row.id, action: 'would_requeue' });
        continue;
      }

      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: {
          status: 'PENDING',
          attempts: 0,
          nextRetryAt: null,
          lastError: 'safe_requeue_cli',
          processingStartedAt: null,
        },
      });
      out.push({ id: row.id, action: 'requeued' });
    }

    console.log(
      JSON.stringify({
        msg: 'outbox_safe_requeue_complete',
        dryRun: !apply,
        total: rows.length,
        summary: summarize(out),
        details: out,
      }),
    );
  } finally {
    await redis.quit();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
