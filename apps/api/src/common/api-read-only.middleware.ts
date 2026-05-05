import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * When API_READ_ONLY=true, block mutating requests under /v1 (GET/HEAD/OPTIONS still allowed).
 */
@Injectable()
export class ApiReadOnlyMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (this.config.get<string>('API_READ_ONLY') !== 'true') {
      next();
      return;
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next();
      return;
    }
    if (!req.path.startsWith('/v1/')) {
      next();
      return;
    }
    res.status(503).json({
      statusCode: 503,
      message: 'API is in read-only mode',
      code: 'READ_ONLY',
    });
  }
}
