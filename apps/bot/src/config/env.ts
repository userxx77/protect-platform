import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_APPLICATION_ID: z.string().min(1),
  API_BASE_URL: z.string().url(),
  BOT_API_KEY: z.string().min(1),
  REDIS_URL: z.string().url().optional(),
  BOT_EVENT_DEDUPE: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  GUILD_COMMANDS_PER_MINUTE: z.coerce.number().optional().default(30),
  API_RETRY_MAX: z.coerce.number().optional().default(3),
  CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().optional().default(5),
  CIRCUIT_OPEN_MS: z.coerce.number().optional().default(30_000),
  SERVER_CONFIG_CACHE_TTL_MS: z.coerce.number().optional().default(60_000),
  NODE_ENV: z.string().optional().default('development'),
  BOT_HEALTH_PORT: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s.trim() === '') {
        return undefined;
      }
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }),
  /** Public dashboard URL (shown in /help); optional */
  WEB_URL: z
    .string()
    .url()
    .optional()
    .transform((s) => {
      if (s === undefined || s.trim() === '') {
        return undefined;
      }
      return s.trim().replace(/\/$/, '');
    }),
  DISCORD_GUILD_ID: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s.trim() === '') {
        return undefined;
      }
      return s.trim();
    }),
  /** Optional: channel ID for admin feed embeds (join, pending reports, sync). */
  DISCORD_ADMIN_FEED_CHANNEL_ID: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s.trim() === '') {
        return undefined;
      }
      return s.trim();
    }),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    process.stderr.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'protect-bot',
        level: 'error',
        message: 'env_validation_failed',
        msg: 'env_validation_failed',
        issues: parsed.error.flatten().fieldErrors,
      })}\n`,
    );
    throw new Error('Invalid environment');
  }
  return parsed.data;
}

export function apiBaseV1(env: Env): string {
  const raw = env.API_BASE_URL.replace(/\/$/, '');
  return raw.endsWith('/v1') ? raw : `${raw}/v1`;
}
