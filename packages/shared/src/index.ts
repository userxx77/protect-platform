import { z } from 'zod';

import { FlagActionLevelSchema } from './flag-levels';

export * from './domain-events';
export * from './admin-discord-ids';
export * from './flag-levels';

export const flagLevels = [
  'CLEAN',
  'WATCH',
  'SUSPICIOUS',
  'HIGH_RISK',
  'CONFIRMED_CHEATER',
] as const;

/** When a joining member is at/above the server's alert threshold */
export const JoinActionPolicySchema = z.enum(['log', 'notify', 'quarantine', 'kick', 'ban']);

export type JoinActionPolicy = z.infer<typeof JoinActionPolicySchema>;

export type FlagLevel = (typeof flagLevels)[number];

export const FlagLevelSchema = z.enum(flagLevels);

export const UserPublicSchema = z.object({
  discordId: z.string(),
  flagScore: z.number(),
  flagLevel: FlagLevelSchema,
  flagCount: z.number().optional(),
  updatedAt: z.string(),
  stateVersion: z.number().int().optional(),
});

export type UserPublic = z.infer<typeof UserPublicSchema>;

export const CreateFlagBodySchema = z.object({
  targetDiscordId: z.string().regex(/^\d{17,20}$/),
  actorDiscordId: z.string().regex(/^\d{17,20}$/),
  reason: z.string().min(1).max(2000),
  guildId: z.string().regex(/^\d{17,20}$/).optional(),
  /** Trusted /flag severity → server maps to weight. */
  severity: FlagActionLevelSchema.optional(),
});

export type CreateFlagBody = z.infer<typeof CreateFlagBodySchema>;

export const CreateReportBodySchema = z.object({
  reporterDiscordId: z.string().regex(/^\d{17,20}$/),
  targetDiscordId: z.string().regex(/^\d{17,20}$/),
  reason: z.string().min(1).max(2000),
  guildId: z.string().regex(/^\d{17,20}$/).optional(),
  /** Reporter-indicated severity (bot/dashboard). */
  allegedFlagLevel: FlagActionLevelSchema.optional(),
});

export type CreateReportBody = z.infer<typeof CreateReportBodySchema>;

export const ServerConfigSchema = z.object({
  alertChannelId: z.string().regex(/^\d{17,20}$/).optional(),
  /** Minimum flag level to alert on join / checks */
  alertMinLevel: FlagLevelSchema.optional(),
  mentionRoleIds: z.array(z.string().regex(/^\d{17,20}$/)).optional(),
  /** When true, members at/above joinHoldMinLevel get a communication timeout on join + moderation card */
  joinHoldEnabled: z.boolean().optional(),
  /** Discord communication timeout duration (1–40320 minutes, ~28 days max) */
  joinHoldDurationMinutes: z.number().int().min(1).max(40320).optional(),
  /** Minimum reputation level to apply join hold + buttons (independent of alertMinLevel) */
  joinHoldMinLevel: FlagLevelSchema.optional(),
  /**
   * What to do when a join meets alert threshold (default: notify — match legacy ping behavior).
   * kick/ban require bot permissions; prefer explicit staff setup.
   */
  joinActionPolicy: JoinActionPolicySchema.optional(),
});

export const UpsertServerConfigBodySchema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  config: ServerConfigSchema,
});

export type UpsertServerConfigBody = z.infer<typeof UpsertServerConfigBodySchema>;

export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
});

export const HealthSchema = z.object({
  status: z.literal('ok'),
  uptimeSec: z.number(),
});

export const ReadySchema = z.object({
  database: z.boolean(),
  redis: z.boolean(),
});
