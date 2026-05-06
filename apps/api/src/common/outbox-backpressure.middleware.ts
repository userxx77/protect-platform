import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

/**
 * When outbox pending exceeds threshold (from Redis snapshot written by worker),
 * reject mutating /v1 requests with 503.
 */
@Injectable()
export class OutboxBackpressureMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    void this.handle(req, res, next).catch(() => next());
  }

  private async handle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const threshold = Number(
      this.config.get<string>('API_OUTBOX_REJECT_THRESHOLD') ?? '0',
    );
    if (threshold <= 0 || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      next();
      return;
    }
    if (!req.path.startsWith('/v1/')) {
      next();
      return;
    }
    const raw = this.redis.raw;
    if (!raw) {
      next();
      return;
    }
    try {
      const snap = await raw.get('protect:outbox:backlog_snapshot');
      if (!snap) {
        next();
        return;
      }
      const pending = (JSON.parse(snap) as { pending?: number }).pending ?? 0;
      if (pending > threshold) {
        res.setHeader('Retry-After', '30');
        res.status(503).json({
          statusCode: 503,
          message: 'Service temporarily unavailable (event backlog)',
          code: 'OUTBOX_BACKPRESSURE',
        });
        return;
      }
    } catch {
      next();
      return;
    }
    next();
  }
}
