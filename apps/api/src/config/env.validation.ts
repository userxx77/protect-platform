import { z } from 'zod';

/**
 * Fail-fast validation before Nest boots. Does not alter runtime config shape
 * (ConfigModule still reads process.env).
 */
const rawSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.string().optional().default('development'),
  REDIS_URL: z.string().optional(),
  REDIS_OPTIONAL: z.string().optional(),
  BOT_API_KEY: z.string().optional(),
  DASHBOARD_JWT_SECRET: z.string().optional(),
});

function emitValidationError(payload: Record<string, unknown>): never {
  process.stderr.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'protect-api',
      level: 'error',
      message: 'env_validation_failed',
      msg: 'env_validation_failed',
      ...payload,
    })}\n`,
  );
  throw new Error('Invalid environment configuration');
}

export function validateProcessEnv(): void {
  const parsed = rawSchema.safeParse(process.env);
  if (!parsed.success) {
    emitValidationError({
      issues: parsed.error.flatten().fieldErrors,
      detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }

  const env = parsed.data;
  const redisOptional = env.REDIS_OPTIONAL === 'true';
  const hasRedis =
    env.REDIS_URL !== undefined && env.REDIS_URL.trim().length > 0;
  if (!redisOptional && !hasRedis) {
    emitValidationError({
      issue:
        'REDIS_URL is required in production unless REDIS_OPTIONAL=true (API uses Redis for rate limits, events, and worker coordination).',
    });
  }

  if (env.NODE_ENV === 'production') {
    if (!env.BOT_API_KEY?.trim()) {
      emitValidationError({
        issue:
          'BOT_API_KEY is required when NODE_ENV=production (same value the Discord bot sends as x-api-key).',
      });
    }
    if (!env.DASHBOARD_JWT_SECRET?.trim()) {
      emitValidationError({
        issue:
          'DASHBOARD_JWT_SECRET is required when NODE_ENV=production (must match the web app JWT secret).',
      });
    }
  }
}