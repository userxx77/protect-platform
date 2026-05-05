import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS',
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const url = config.get<string>('REDIS_URL')?.trim();
        const optional = config.get<string>('REDIS_OPTIONAL') === 'true';
        if (!url) {
          if (optional) {
            return null;
          }
          throw new Error(
            'REDIS_URL is required (set REDIS_OPTIONAL=true to run without Redis)',
          );
        }
        return new Redis(url, { maxRetriesPerRequest: 2 });
      },
    },
    RedisService,
  ],
  exports: ['REDIS', RedisService],
})
export class RedisModule {}
