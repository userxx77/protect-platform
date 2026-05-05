import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject('REDIS') public readonly raw: Redis | null) {}

  isAvailable(): boolean {
    return this.raw != null;
  }

  /** Throws if Redis was not configured (and REDIS_OPTIONAL=false). */
  get client(): Redis {
    if (!this.raw) {
      throw new Error('Redis is not available');
    }
    return this.raw;
  }

  async onModuleDestroy() {
    await this.raw?.quit();
  }

  async ping(): Promise<boolean> {
    if (!this.raw) return false;
    try {
      return (await this.raw.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
