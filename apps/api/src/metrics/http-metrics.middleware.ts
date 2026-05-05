import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

function routePath(req: Request): string {
  // Nest may set route.path on the request after routing
  const r = req as Request & { route?: { path?: string } };
  return r.route?.path ?? req.path ?? '';
}

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      this.metrics.recordRequest({
        method: req.method,
        route: routePath(req),
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  }
}
