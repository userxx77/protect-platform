import type { INestApplication } from '@nestjs/common';
import { PrismaClient, FlagLevel } from '@prisma/client';
import request from 'supertest';
import { createIntegrationApp } from '../helpers/bootstrap-integration-app';

const shouldSkip =
  process.env.SKIP_INTEGRATION === 'true' || !process.env.DATABASE_URL;

function id71(): string {
  return (
    BigInt(71_000_000_000_000_000) + BigInt(Math.floor(Math.random() * 10_000))
  ).toString();
}

const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('integration scenario C (REDIS_OPTIONAL)', () => {
  let app: INestApplication;
  let savedRedisUrl: string | undefined;
  let savedRedisOptional: string | undefined;
  const botKey =
    process.env.BOT_API_KEY ?? 'integration-test-bot-key-redis-optional';

  beforeAll(async () => {
    savedRedisUrl = process.env.REDIS_URL;
    savedRedisOptional = process.env.REDIS_OPTIONAL;
    jest.resetModules();
    process.env.REDIS_OPTIONAL = 'true';
    delete process.env.REDIS_URL;
    process.env.BOT_API_KEY = botKey;
    process.env.DASHBOARD_JWT_SECRET =
      process.env.DASHBOARD_JWT_SECRET ?? 'integration-test-jwt-secret-redis-optional';
    const { AppModule } = await import('../../src/app.module');
    app = await createIntegrationApp(AppModule);
  });

  afterAll(async () => {
    await app?.close();
    if (savedRedisUrl !== undefined) {
      process.env.REDIS_URL = savedRedisUrl;
    }
    if (savedRedisOptional !== undefined) {
      process.env.REDIS_OPTIONAL = savedRedisOptional;
    } else {
      delete process.env.REDIS_OPTIONAL;
    }
  });

  it('GET /v1/user returns 200 from DB when Redis is disabled', async () => {
    const prisma = new PrismaClient();
    const discordId = id71();
    try {
      await prisma.user.create({
        data: {
          discordId,
          flagScore: 3,
          flagLevel: FlagLevel.SUSPICIOUS,
        },
      });
      const res = await request(app.getHttpServer())
        .get(`/v1/user/${discordId}`)
        .set('x-api-key', botKey)
        .set('x-protect-skip-user-cache', 'true')
        .expect(200);
      expect(res.body.flagScore).toBe(3);
      expect(res.body.flagLevel).toBe('SUSPICIOUS');
    } finally {
      await prisma.user.deleteMany({ where: { discordId } });
      await prisma.$disconnect();
    }
  });

  it('POST /v1/report returns 503 without Redis (rate limits)', async () => {
    const targetDiscordId = id71();
    const reporterDiscordId = id71();
    await request(app.getHttpServer())
      .post('/v1/report')
      .set('x-api-key', botKey)
      .send({
        reporterDiscordId,
        targetDiscordId,
        reason: 'redis optional scenario C',
      })
      .expect(503);
  });
});
