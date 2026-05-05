import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  NODE_ENV: z.string().optional().default('development'),
  WORKER_HEALTH_PORT: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s.trim() === '') {
        return undefined;
      }
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }),
  WORKER_INSTANCE_ID: z.string().optional(),
  OUTBOX_POLL_MS: z.coerce.number().optional(),
  OUTBOX_BATCH_SIZE: z.coerce.number().optional(),
  OUTBOX_MAX_BATCH_SIZE: z.coerce.number().optional(),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().optional(),
  FLAG_DECAY_INTERVAL_MS: z.coerce.number().optional(),
  OUTBOX_MIN_IDLE_MS: z.coerce.number().optional(),
  PROCESSING_LEASE_SEC: z.coerce.number().optional(),
  PROCESSED_EVENT_TTL_SEC: z.coerce.number().optional(),
  OUTBOX_BACKLOG_WARN: z.coerce.number().optional(),
  OUTBOX_BACKLOG_CRITICAL: z.coerce.number().optional(),
  PLATFORM_STATS_INTERVAL_MS: z.coerce.number().optional().default(120_000),
});

export type WorkerEnv = z.infer<typeof schema>;

export function loadWorkerEnv(): WorkerEnv {
  const p = schema.safeParse(process.env);
  if (!p.success) {
    process.stderr.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'protect-worker',
        level: 'error',
        message: 'env_validation_failed',
        msg: 'env_validation_failed',
        issues: p.error.flatten().fieldErrors,
        detail: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })}\n`,
    );
    throw new Error('Invalid worker environment');
  }
  return p.data;
}
