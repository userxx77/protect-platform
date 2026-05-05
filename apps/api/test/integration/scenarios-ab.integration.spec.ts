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

/** Matches main/worker-style outbox batch options (constants for tests). */
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
    BigInt(70_000_000_000_000_000) + BigInt(Math.floor(Math.random() * 10_000))
  ).toString();
}

async function drainOutboxForTarget(
  prisma: PrismaClient,
  redis: Redis,
  targetDiscordId: string,
): Promise<void> {
  for (let i = 0; i < 25; i++) {
    const open = await prisma.outboxEvent.count({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        OR: [
          { payload: { path: ['targetDiscordId'], equals: targetDiscordId } },
          { payload: { path: ['discordId'], equals: targetDiscordId } },
        ],
      },
    });
    if (open === 0) {
      return;
    }
    await processOutboxBatch(prisma, redis, workerOpts);
  }
  const still = await prisma.outboxEvent.count({
    where: {
      status: { in: ['PENDING', 'PROCESSING'] },
      OR: [
        { payload: { path: ['targetDiscordId'], equals: targetDiscordId } },
        { payload: { path: ['discordId'], equals: targetDiscordId } },
      ],
    },
  });
  if (still > 0) {
    throw new Error(
      `outbox still pending for target ${targetDiscordId}: count=${still}`,
    );
  }
}

async function cleanupDiscordPair(
  prisma: PrismaClient,
  targetDiscordId: string,
  reporterDiscordId: string,
): Promise<void> {
  const evs = await prisma.outboxEvent.findMany({
    where: {
      OR: [
        { payload: { path: ['targetDiscordId'], equals: targetDiscordId } },
        { payload: { path: ['discordId'], equals: targetDiscordId } },
        { payload: { path: ['reporterDiscordId'], equals: reporterDiscordId } },
      ],
    },
    select: { id: true },
  });
  const eids = evs.map((e) => e.id);
  if (eids.length) {
    await prisma.processedEvent.deleteMany({ where: { eventId: { in: eids } } });
    await prisma.outboxEvent.deleteMany({ where: { id: { in: eids } } });
  }
  const users = await prisma.user.findMany({
    where: { discordId: { in: [targetDiscordId, reporterDiscordId] } },
    select: { id: true },
  });
  const uids = users.map((u) => u.id);
  if (uids.length) {
    await prisma.report.deleteMany({ where: { reportedUserId: { in: uids } } });
    await prisma.flag.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
  }
  await prisma.trustedUser.deleteMany({
    where: { discordUserId: reporterDiscordId },
  });
}

const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('integration scenarios A & B', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let redis: Redis;
  const botKey =
    process.env.BOT_API_KEY ?? 'integration-test-bot-key-scenarios-ab';

  beforeAll(async () => {
    process.env.BOT_API_KEY = botKey;
    process.env.DASHBOARD_JWT_SECRET =
      process.env.DASHBOARD_JWT_SECRET ?? 'integration-test-jwt-secret-scenarios-ab';
    prisma = new PrismaClient();
    redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 2 });
    app = await createIntegrationApp(AppModule);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
    redis.disconnect();
  });

  describe('A: POST /v1/report → worker drain → GET /v1/user', () => {
    it('creates pending outbox rows, drains them, and returns consistent user', async () => {
      const targetDiscordId = id17();
      const reporterDiscordId = id17();
      try {
        await prisma.trustedUser.upsert({
          where: { discordUserId: reporterDiscordId },
          create: { discordUserId: reporterDiscordId, trustLevel: 1 },
          update: {},
        });
        await request(app.getHttpServer())
          .post('/v1/report')
          .set('x-api-key', botKey)
          .send({
            reporterDiscordId,
            targetDiscordId,
            reason: 'integration scenario A',
          })
          .expect(200);

        const pending = await prisma.outboxEvent.findMany({
          where: {
            status: 'PENDING',
            OR: [
              { payload: { path: ['targetDiscordId'], equals: targetDiscordId } },
              { payload: { path: ['discordId'], equals: targetDiscordId } },
            ],
          },
        });
        const types = new Set(pending.map((p) => p.type));
        expect(types.has('user.reported')).toBe(true);
        expect(types.has('user.updated')).toBe(true);

        await drainOutboxForTarget(prisma, redis, targetDiscordId);

        const res = await request(app.getHttpServer())
          .get(`/v1/user/${targetDiscordId}`)
          .set('x-api-key', botKey)
          .set('x-protect-skip-user-cache', 'true')
          .expect(200);

        expect(res.body.flagScore).toBeGreaterThanOrEqual(1);
        expect(res.body.flagLevel).toBe('SUSPICIOUS');
      } finally {
        await cleanupDiscordPair(prisma, targetDiscordId, reporterDiscordId);
      }
    });
  });

  describe('B: raw outbox → worker (no HTTP)', () => {
    it('marks inserted row DISPATCHED after batch', async () => {
      const targetDiscordId = id17();
      const reporterDiscordId = id17();
      const reportId = randomUUID();
      const row = await prisma.outboxEvent.create({
        data: {
          type: 'user.reported',
          payload: {
            reportId,
            targetDiscordId,
            reporterDiscordId,
            guildId: null,
          },
          status: 'PENDING',
        },
      });
      try {
        await processOutboxBatch(prisma, redis, workerOpts);
        const updated = await prisma.outboxEvent.findUnique({
          where: { id: row.id },
        });
        expect(updated?.status).toBe('DISPATCHED');
        const pe = await prisma.processedEvent.findUnique({
          where: { eventId: row.id },
        });
        expect(pe).not.toBeNull();
      } finally {
        await prisma.processedEvent.deleteMany({ where: { eventId: row.id } });
        await prisma.outboxEvent.deleteMany({ where: { id: row.id } });
      }
    });
  });
});
