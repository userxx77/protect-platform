import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { AuthIdentity } from './auth.types';

@Injectable()
export class BotOrJwtGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      partialIdentity?: AuthIdentity;
    }>();
    const apiKey = req.headers['x-api-key'];
    const expected = this.config.get<string>('BOT_API_KEY');
    if (expected && typeof apiKey === 'string' && apiKey === expected) {
      req.partialIdentity = { kind: 'bot' };
      return true;
    }
    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing credentials');
    }
    const token = auth.slice('Bearer '.length);
    const secret = this.config.get<string>('DASHBOARD_JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Server JWT not configured');
    }
    try {
      const payload = this.jwt.verify<{ sub?: string }>(token, { secret });
      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token');
      }
      req.partialIdentity = { kind: 'user', discordId: String(payload.sub) };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
