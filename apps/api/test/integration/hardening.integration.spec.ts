import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import request from 'supertest';
import { processOutboxBatch } from '../../../worker/src/dispatch';
import { AppModule } from '../../src/app.module';
import { createIntegrationApp } from '../helpers/bootstrap-integration-app';

const shouldSkip =
  process.env.SKIP_INTEGRATION === 'true' ||
  !process.env.DATABASE_URL ||
  !process.env.REDIS_URL;

const workerOpts = {
  batch: 50,
  maxAttempts: 12,
  processingLeaseSec: 300,
  processedTtlSec: 604_800,
  backlogWarn: 1000,
  backlogCritical: 5000,
};

function id17(): string {
  return (
    BigInt(73_000_000_000_000_000) + BigInt(Math.floor(Math.random() * 10_000))
  ).toString();
}

const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('production hardening integration', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let redis: Redis;
  const botKey =
    process.env.BOT_API_KEY ?? 'integration-test-bot-key-hardening';

  beforeAll(async () => {
    process.env.BOT_API_KEY = botKey;
    process.env.DASHBOARD_JWT_SECRET =
      process.env.DASHBOARD_JWT_SECRET ?? 'integration-test-jwt-secret-hardening';
    prisma = new PrismaClient();
    redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 2 });
    app = await createIntegrationApp(AppModule);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('concurrent community reports on same target sum scores (no lost increments)', async () => {
    const target = id17();
    const r1 = id17();
    const r2 = id17();
    try {
      await Promise.all([
        request(app.getHttpServer())
          .post('/v1/report')
          .set('x-api-key', botKey)
          .send({
            reporterDiscordId: r1,
            targetDiscordId: target,
            reason: 'concurrent hardening A',
          })
          .expect(200),
        request(app.getHttpServer())
          .post('/v1/report')
          .set('x-api-key', botKey)
          .send({
            reporterDiscordId: r2,
            targetDiscordId: target,
            reason: 'concurrent hardening B',
          })
          .expect(200),
      ]);

      const u = await prisma.user.findUnique({ where: { discordId: target } });
      expect(u).not.toBeNull();
      const w = Number(process.env.FLAG_WEIGHT_COMMUNITY_REPORT ?? 1);
      expect(u!.flagScore).toBe(2 * w);
    } finally {
      const users = await prisma.user.findMany({
        where: { discordId: { in: [target, r1, r2] } },
        select: { id: true },
      });
      const ids = users.map((x) => x.id);
      if (ids.length) {
        const evs = await prisma.outboxEvent.findMany({
          where: {
            OR: [
              { payload: { path: ['targetDiscordId'], equals: target } },
              { payload: { path: ['discordId'], equals: target } },
              { payload: { path: ['reporterDiscordId'], equals: r1 } },
              { payload: { path: ['reporterDiscordId'], equals: r2 } },
            ],
          },
          select: { id: true },
        });
        const eids = evs.map((e) => e.id);
        if (eids.length) {
          await prisma.processedEvent.deleteMany({ where: { eventId: { in: eids } } });
          await prisma.outboxEvent.deleteMany({ where: { id: { in: eids } } });
        }
        await prisma.report.deleteMany({ where: { reportedUserId: { in: ids } } });
        await prisma.flag.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    }
  });

  it('dispatch reconciles DB when Redis dispatch marker exists (no second MULTI publish needed)', async () => {
    const target = id17();
    const reporter = id17();
    const reportId = randomUUID();
    const row = await prisma.outboxEvent.create({
      data: {
        type: 'user.reported',
        payload: {
          reportId,
          targetDiscordId: target,
          reporterDiscordId: reporter,
          guildId: null,
        },
        status: 'PENDING',
      },
    });
    const markerKey = `protect:event:processed:${row.id}`;
    try {
      await processOutboxBatch(prisma, redis, workerOpts);
      let ob = await prisma.outboxEvent.findUnique({ where: { id: row.id } });
      expect(ob?.status).toBe('DISPATCHED');
      const mk = await redis.get(markerKey);
      expect(mk).toBe('1');

      await prisma.processedEvent.deleteMany({ where: { eventId: row.id } });
      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: { status: 'PENDING', processingStartedAt: null },
      });

      await processOutboxBatch(prisma, redis, workerOpts);
      ob = await prisma.outboxEvent.findUnique({ where: { id: row.id } });
      expect(ob?.status).toBe('DISPATCHED');
      const pe = await prisma.processedEvent.findUnique({
        where: { eventId: row.id },
      });
      expect(pe).not.toBeNull();
    } finally {
      await redis.del(markerKey);
      await prisma.processedEvent.deleteMany({ where: { eventId: row.id } });
      await prisma.outboxEvent.deleteMany({ where: { id: row.id } });
    }
  });
});

const skipStress =
  process.env.SKIP_STRESS === 'true' ||
  process.env.SKIP_INTEGRATION === 'true' ||
  !process.env.DATABASE_URL ||
  !process.env.REDIS_URL;

(skipStress ? describe.skip : describe)('outbox burst drain (gated)', () => {
  let prisma: PrismaClient;
  let redis: Redis;

  beforeAll(() => {
    prisma = new PrismaClient();
    redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 2 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('drains many raw outbox rows without loss', async () => {
    const n = Math.min(Number(process.env.STRESS_OUTBOX_N ?? 25), 200);
    const target = id17();
    const reporter = id17();
    const ids: string[] = [];
    try {
      for (let i = 0; i < n; i++) {
        const r = await prisma.outboxEvent.create({
          data: {
            type: 'user.reported',
            payload: {
              reportId: randomUUID(),
              targetDiscordId: target,
              reporterDiscordId: reporter,
              guildId: null,
            },
            status: 'PENDING',
          },
          select: { id: true },
        });
        ids.push(r.id);
      }
      for (let i = 0; i < 10; i++) {
        await processOutboxBatch(prisma, redis, workerOpts);
        const pending = await prisma.outboxEvent.count({
          where: { id: { in: ids }, status: 'PENDING' },
        });
        if (pending === 0) {
          break;
        }
      }
      const dispatched = await prisma.outboxEvent.count({
        where: { id: { in: ids }, status: 'DISPATCHED' },
      });
      expect(dispatched).toBe(n);
    } finally {
      await prisma.processedEvent.deleteMany({ where: { eventId: { in: ids } } });
      await prisma.outboxEvent.deleteMany({ where: { id: { in: ids } } });
    }
  });
});
