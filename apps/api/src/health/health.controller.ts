import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok' as const,
      service: 'protect-api',
      uptimeSec: process.uptime(),
    };
  }

  /**
   * Kubernetes-style readiness: HTTP 503 when dependencies are not usable.
   * When REDIS_OPTIONAL=true and Redis is not configured, Redis is not required for readiness.
   */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
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
    const body = {
      service: 'protect-api',
      ready,
      database,
      redis: redisOptional && !this.redis.isAvailable() ? null : redisReady,
      redisOptional,
    };

    if (!ready) {
      res.status(503);
    }
    return body;
  }
}
