import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class InternalOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getOutboxEventTrace(id: string) {
    const row = await this.prisma.outboxEvent.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Outbox event not found');
    }
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      attempts: row.attempts,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
      processingStartedAt: row.processingStartedAt?.toISOString() ?? null,
      nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
      lastError: row.lastError,
      payload: row.payload,
    };
  }

  async getOutboxBacklog() {
    const [pending, processing, failed, oldestPending] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      this.prisma.outboxEvent.count({ where: { status: 'PROCESSING' } }),
      this.prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
      this.prisma.outboxEvent.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const now = Date.now();
    const oldestLagMs = oldestPending
      ? now - oldestPending.createdAt.getTime()
      : null;

    return {
      pending,
      processing,
      failed,
      oldestPendingLagMs: oldestLagMs,
      capturedAt: new Date().toISOString(),
    };
  }

  async getWorkerStatus() {
    const raw = this.redis.raw;
    if (!raw) {
      return {
        redisAvailable: false,
        degraded: true,
        instances: [] as { instanceId: string; lastHeartbeatMs: number | null }[],
      };
    }
    const lastActive = await raw.get('protect:worker:last_active_at');
    const dispatched = await raw.get('protect:worker:events_dispatched');
    const instIds = await raw.smembers('protect:worker:instances');
    const instances: { instanceId: string; lastHeartbeatMs: number | null }[] =
      [];
    for (const id of instIds) {
      const hb = await raw.get(`protect:worker:hb:${id}`);
      instances.push({
        instanceId: id,
        lastHeartbeatMs: hb ? Number(hb) : null,
      });
    }
    return {
      redisAvailable: true,
      degraded: false,
      lastWorkerActiveAt: lastActive ? Number(lastActive) : null,
      eventsDispatchedTotal: dispatched ? Number(dispatched) : 0,
      instances,
    };
  }

  /** Unified operator debug snapshot (admin JWT): probes + backlog + worker + timing hints. */
  async getOpsDebug() {
    const now = Date.now();
    const overview = await this.getOpsOverview();

    let postgresLatencyMs: number | null = null;
    const pgStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      postgresLatencyMs = Date.now() - pgStart;
    } catch {
      postgresLatencyMs = null;
    }

    let redisLatencyMs: number | null = null;
    const redisStart = Date.now();
    try {
      const ok = await this.redis.ping();
      redisLatencyMs = ok ? Date.now() - redisStart : null;
    } catch {
      redisLatencyMs = null;
    }

    const worker = overview.worker;
    const instancesWithAge = (
      worker.instances as { instanceId: string; lastHeartbeatMs: number | null }[]
    ).map((inst) => {
      const hb = inst.lastHeartbeatMs;
      return {
        instanceId: inst.instanceId,
        lastHeartbeatMs: hb,
        heartbeatAgeSec:
          hb != null ? Math.round((now - hb) / 1000) : null,
        heartbeatStale: hb == null ? true : now - hb > 90_000,
      };
    });

    const anyFreshHeartbeat = instancesWithAge.some(
      (i) => i.lastHeartbeatMs != null && now - i.lastHeartbeatMs < 90_000,
    );

    return {
      ...overview,
      capturedForDebugAt: new Date().toISOString(),
      timings: {
        postgresQueryMs: postgresLatencyMs,
        redisPingMs: redisLatencyMs,
      },
      worker: {
        ...worker,
        heartbeatObserved: anyFreshHeartbeat,
        instances: instancesWithAge,
      },
      hints: {
        workerHeartbeatKeyPrefix: 'protect:worker:hb:',
        backlogSnapshotKey: 'protect:outbox:backlog_snapshot',
        validateScript: 'validate-deployment.sh (repo root)',
      },
    };
  }

  /** Aggregated deployment signals for operators (JWT admin). */
  async getOpsOverview() {
    let database = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }

    const redisOptional = process.env.REDIS_OPTIONAL === 'true';
    let redisReady: boolean;
    if (redisOptional && !this.redis.isAvailable()) {
      redisReady = true;
    } else {
      redisReady = await this.redis.ping();
    }

    const ready = database && redisReady;

    const [backlog, workerStatus] = await Promise.all([
      this.getOutboxBacklog(),
      this.getWorkerStatus(),
    ]);

    const version =
      process.env.GIT_SHA ??
      process.env.npm_package_version ??
      'unknown';

    return {
      service: 'protect-api',
      capturedAt: new Date().toISOString(),
      version,
      ready,
      probes: {
        database,
        redis:
          redisOptional && !this.redis.isAvailable() ? null : redisReady,
        redisOptional,
      },
      backlog,
      worker: workerStatus,
    };
  }
}
