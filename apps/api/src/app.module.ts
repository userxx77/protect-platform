import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FlagsModule } from './flags/flags.module';
import { ReportsModule } from './reports/reports.module';
import { ServersModule } from './servers/servers.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { RequestIdHeaderInterceptor } from './common/request-id-header.interceptor';
import { MetricsModule } from './metrics/metrics.module';
import { HttpMetricsMiddleware } from './metrics/http-metrics.middleware';
import { InternalModule } from './internal/internal.module';
import { BotModule } from './bot/bot.module';
import { ApiReadOnlyMiddleware } from './common/api-read-only.middleware';
import { OutboxBackpressureMiddleware } from './common/outbox-backpressure.middleware';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { AdminModule } from './admin/admin.module';
import { MeModule } from './me/me.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PublicModule } from './platform-stats/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
        customProps: (req, _res) => {
          const rid = (req as { requestId?: string }).requestId;
          return {
            service: 'protect-api',
            environment: process.env.NODE_ENV ?? 'development',
            requestId: rid,
            correlationId: rid,
          };
        },
        redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
        autoLogging:
          process.env.NODE_ENV === 'production'
            ? {
                ignore: (req) => {
                  const u = (req as { url?: string }).url ?? '';
                  return (
                    u === '/health' ||
                    u === '/ready' ||
                    u === '/metrics' ||
                    u.startsWith('/docs')
                  );
                },
              }
            : undefined,
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    RedisModule,
    AuthModule,
    EventsModule,
    AuditModule,
    UsersModule,
    FlagsModule,
    ReportsModule,
    ServersModule,
    HealthModule,
    IntegrationsModule,
    MetricsModule,
    InternalModule,
    BotModule,
    EntitlementsModule,
    AdminModule,
    MeModule,
    WebhooksModule,
    PublicModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestIdHeaderInterceptor },
    ApiReadOnlyMiddleware,
    OutboxBackpressureMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        RequestIdMiddleware,
        HttpMetricsMiddleware,
        ApiReadOnlyMiddleware,
        OutboxBackpressureMiddleware,
      )
      .forRoutes('*');
  }
}
