import 'dotenv/config';
import http from 'node:http';
import os from 'node:os';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { processOutboxBatch } from './dispatch';
import { runDecayJob } from './decay-job';
import { runMemberSyncSchedule } from './member-sync-schedule-job';
import { runPlatformStatsRefreshSafe } from './platform-stats-job';
import { loadWorkerEnv } from './env';
import { logWorker } from './log';

const env = loadWorkerEnv();
const prisma = new PrismaClient();
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 20,
  retryStrategy(times) {
    const ms = Math.min(times * 400, 15_000);
    if (times === 1 || times % 15 === 0) {
      logWorker('warn', 'redis_reconnect_scheduled', {
        attempt: times,
        nextRetryMs: ms,
      });
    }
    return ms;
  },
});

redis.on('ready', () => {
  logWorker('info', 'redis_connection_ready', {});
});

redis.on('error', (err) => {
  logWorker('warn', 'redis_client_error', { error: String(err).slice(0, 400) });
});

const pollMs = env.OUTBOX_POLL_MS ?? 500;
const batch = env.OUTBOX_BATCH_SIZE ?? 50;
const maxBatch = env.OUTBOX_MAX_BATCH_SIZE ?? 200;
const maxAttempts = env.OUTBOX_MAX_ATTEMPTS ?? 12;
const decayIntervalMs = env.FLAG_DECAY_INTERVAL_MS ?? 300_000;
const minIdleMs = env.OUTBOX_MIN_IDLE_MS ?? 0;
const processingLeaseSec = env.PROCESSING_LEASE_SEC ?? 300;
const processedTtlSec = env.PROCESSED_EVENT_TTL_SEC ?? 604800;
const backlogWarn = env.OUTBOX_BACKLOG_WARN ?? 1000;
const backlogCritical = env.OUTBOX_BACKLOG_CRITICAL ?? 5000;
const instanceId = env.WORKER_INSTANCE_ID ?? os.hostname();
const platformStatsIntervalMs = env.PLATFORM_STATS_INTERVAL_MS ?? 120_000;
const memberSyncIntervalMs = env.MEMBER_SYNC_INTERVAL_MS ?? 86_400_000;

let running = true;

function effectiveBatch(): number {
  return Math.min(batch, maxBatch);
}

function nextSleepMs(backlogPending: number): number {
  const factor =
    1 + Math.min(3, Math.floor(backlogPending / Math.max(1, backlogWarn)));
  return Math.min(8000, pollMs * factor) + minIdleMs;
}

function startHealthServer(port: number): void {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/ready') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'protect-worker',
          instanceId,
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, '0.0.0.0', () => {
    logWorker('info', 'worker_health_listen', { port });
  });
}

function sleepWithShutdown(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const tid = setTimeout(() => {
      process.off('SIGTERM', onStop);
      process.off('SIGINT', onStop);
      resolve();
    }, ms);
    const onStop = () => {
      clearTimeout(tid);
      process.off('SIGTERM', onStop);
      process.off('SIGINT', onStop);
      resolve();
    };
    process.once('SIGTERM', onStop);
    process.once('SIGINT', onStop);
  });
}

async function waitForDependencies(): Promise<void> {
  const maxAttempts = 120;
  const sleepMs = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      logWorker('info', 'worker_dependencies_ready', { attempt });
      return;
    } catch (e) {
      logWorker('warn', 'worker_dependencies_wait', {
        attempt,
        maxAttempts,
        error: String(e).slice(0, 400),
      });
      await new Promise((r) => setTimeout(r, sleepMs));
    }
  }
  throw new Error('Worker could not reach Postgres or Redis after retries');
}

async function main(): Promise<void> {
  if (env.WORKER_HEALTH_PORT != null) {
    startHealthServer(env.WORKER_HEALTH_PORT);
  }

  logWorker('info', 'worker_connecting_dependencies', {});
  await waitForDependencies();

  let lastDecayAt = 0;
  let lastPlatformStatsAt = 0;
  let lastMemberSyncScheduleAt = 0;
  logWorker('info', 'worker_started', { batch: effectiveBatch() });

  const onStop = (signal: string) => {
    running = false;
    logWorker('info', 'worker_shutdown_signal', { signal });
  };
  process.on('SIGTERM', () => onStop('SIGTERM'));
  process.on('SIGINT', () => onStop('SIGINT'));

  while (running) {
    let backlogPending = 0;
    try {
      const snapRaw = await redis.get('protect:outbox:backlog_snapshot');
      if (snapRaw) {
        try {
          backlogPending =
            (JSON.parse(snapRaw) as { pending?: number }).pending ?? 0;
        } catch {
          backlogPending = 0;
        }
      }
    } catch {
      backlogPending = 0;
    }

    try {
      await processOutboxBatch(prisma, redis, {
        batch: effectiveBatch(),
        maxAttempts,
        processingLeaseSec,
        processedTtlSec,
        backlogWarn,
        backlogCritical,
      });
    } catch (e) {
      logWorker('error', 'outbox_batch_error', { error: String(e) });
    }

    try {
      await redis.set(
        `protect:worker:hb:${instanceId}`,
        String(Date.now()),
        'EX',
        45,
      );
      await redis.set(
        'protect:worker:last_active_at',
        String(Date.now()),
        'EX',
        90,
      );
      await redis.sadd('protect:worker:instances', instanceId);
      await redis.expire('protect:worker:instances', 120);
    } catch {
      /* ignore heartbeat failures */
    }

    const now = Date.now();
    if (running && now - lastDecayAt >= decayIntervalMs) {
      lastDecayAt = now;
      try {
        await runDecayJob(prisma, redis);
      } catch (e) {
        logWorker('error', 'decay_job_error', { error: String(e) });
      }
    }

    if (
      running &&
      memberSyncIntervalMs > 0 &&
      now - lastMemberSyncScheduleAt >= memberSyncIntervalMs
    ) {
      lastMemberSyncScheduleAt = now;
      try {
        await runMemberSyncSchedule(prisma, memberSyncIntervalMs);
      } catch (e) {
        logWorker('error', 'member_sync_schedule_error', { error: String(e) });
      }
    }

    if (running && now - lastPlatformStatsAt >= platformStatsIntervalMs) {
      lastPlatformStatsAt = now;
      await runPlatformStatsRefreshSafe(prisma);
    }

    if (!running) break;
    await sleepWithShutdown(nextSleepMs(backlogPending));
  }

  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
}

main().catch((err) => {
  logWorker('error', 'worker_fatal', { error: String(err) });
  process.exit(1);
});
