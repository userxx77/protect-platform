import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';

/** Echo correlation / request id on every HTTP response. */
@Injectable()
export class RequestIdHeaderInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ requestId?: string }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const id = req.requestId;
    return next.handle().pipe(
      tap({
        finalize: () => {
          if (id) {
            res.setHeader('X-Request-Id', id);
            res.setHeader('X-Correlation-Id', id);
          }
        },
      }),
    );
  }
}
