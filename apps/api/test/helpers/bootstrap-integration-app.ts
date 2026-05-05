import {
  INestApplication,
  ValidationPipe,
  RequestMethod,
  Type,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

export async function createIntegrationApp(
  moduleType: Type<unknown>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [moduleType],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
      { path: 'internal/events/:id', method: RequestMethod.GET },
      { path: 'internal/outbox/backlog', method: RequestMethod.GET },
      { path: 'internal/worker/status', method: RequestMethod.GET },
      { path: 'internal/metrics/summary', method: RequestMethod.GET },
      { path: 'internal/cache/user/:discordId/validate', method: RequestMethod.GET },
      { path: 'internal/cache/user/:discordId/repair', method: RequestMethod.POST },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}
