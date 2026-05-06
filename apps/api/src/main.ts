import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { validateProcessEnv } from './config/env.validation';
import { AppModule } from './app.module';

function buildCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGINS?.trim();
  const allowList = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  if (process.env.NODE_ENV === 'production') {
    if (allowList.length > 0) {
      return {
        origin: (origin, cb) => {
          if (!origin) {
            cb(null, true);
            return;
          }
          cb(null, allowList.includes(origin));
        },
        credentials: true,
      };
    }
    return { origin: false };
  }
  return { origin: true, credentials: true };
}

async function bootstrap() {
  validateProcessEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
      { path: 'internal/events/:id', method: RequestMethod.GET },
      { path: 'internal/outbox/backlog', method: RequestMethod.GET },
      { path: 'internal/worker/status', method: RequestMethod.GET },
      { path: 'internal/ops/overview', method: RequestMethod.GET },
      { path: 'internal/ops/debug', method: RequestMethod.GET },
      { path: 'internal/metrics/summary', method: RequestMethod.GET },
      { path: 'internal/cache/user/:discordId/validate', method: RequestMethod.GET },
      { path: 'internal/cache/user/:discordId/repair', method: RequestMethod.POST },
    ],
  });

  app.enableCors(buildCorsOptions());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerOff =
    process.env.SWAGGER_ENABLED === '0' ||
    process.env.SWAGGER_ENABLED === 'false' ||
    (process.env.NODE_ENV === 'production' &&
      process.env.SWAGGER_ENABLED !== 'true');
  if (!swaggerOff) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Protect API')
      .setDescription('Anti-cheat intelligence platform (v1 routes are prefixed unless excluded)')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' })
      .addTag('integrations', 'Future game server clients')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.API_PORT ?? '3001';
  await app.listen(port);
}

bootstrap().catch((err) => {
  process.stderr.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'protect-api',
      level: 'error',
      message: 'bootstrap_failed',
      msg: 'bootstrap_failed',
      error: String(err),
    })}\n`,
  );
  process.exit(1);
});