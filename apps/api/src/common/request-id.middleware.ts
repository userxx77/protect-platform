import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { correlationStorage } from './correlation.context';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, _res: Response, next: NextFunction) {
    const header = req.headers['x-request-id'];
    const correlationHeader = req.headers['x-correlation-id'];
    const fromHeader =
      typeof header === 'string'
        ? header
        : typeof correlationHeader === 'string'
          ? correlationHeader
          : undefined;
    const id = fromHeader ?? randomUUID();
    req.requestId = id;
    correlationStorage.run({ correlationId: id, dbQueryCount: 0 }, () => next());
  }
}
