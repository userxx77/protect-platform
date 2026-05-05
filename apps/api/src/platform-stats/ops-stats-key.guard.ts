import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Requires SENTRA_OPS_STATS_KEY and matching Bearer or x-sentra-ops-key header.
 * If the env key is unset, the route is closed (no anonymous access).
 */
@Injectable()
export class OpsStatsKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('SENTRA_OPS_STATS_KEY')?.trim();
    if (!expected) {
      throw new UnauthorizedException('stats_unavailable');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined;
    const header =
      (typeof req.headers['x-sentra-ops-key'] === 'string'
        ? req.headers['x-sentra-ops-key']
        : undefined) ?? bearer;
    if (!header || header !== expected) {
      throw new UnauthorizedException('invalid_ops_key');
    }
    return true;
  }
}
