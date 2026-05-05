/** Redis pub/sub channel names */
export const EVENT_CHANNELS = {
  USER_FLAGGED: 'protect:user.flagged',
  USER_REPORTED: 'protect:user.reported',
  USER_UPDATED: 'protect:user.updated',
  SERVER_CONFIG_UPDATED: 'protect:server.config.updated',
  REPORT_PENDING: 'protect:report.pending',
  GUILD_MEMBERS_SYNC: 'protect:guild.members.sync',
  GUILD_DISCOVERED: 'protect:guild.discovered',
} as const;

/** Single stream for durable ordered consumption (worker writes here). */
export const EVENT_STREAM_KEY = 'protect:events';

export const EVENT_SCHEMA_VERSION = 1 as const;

export type DomainEventType =
  | 'user.flagged'
  | 'user.reported'
  | 'user.updated'
  | 'server.config.updated'
  | 'report.pending'
  | 'guild.members.sync'
  | 'guild.discovered';

export interface DomainEventEnvelope<T = unknown> {
  schemaVersion: typeof EVENT_SCHEMA_VERSION;
  eventId: string;
  type: DomainEventType;
  occurredAt: string;
  correlationId?: string;
  payload: T;
}

export type UserFlaggedPayload = {
  targetDiscordId: string;
  flagLevel: string;
  flagScore: number;
  guildId?: string | null;
  actorDiscordId: string;
  /** Monotonic user aggregate version when present; consumers may ignore. */
  stateVersion?: number;
};

export type UserReportedPayload = {
  reportId: string;
  targetDiscordId: string;
  reporterDiscordId: string;
  guildId?: string | null;
  /** Report reason (truncated in events for log/UI). */
  reason?: string;
};

export type UserUpdatedPayload = {
  discordId: string;
  flagLevel: string;
  flagScore: number;
  /** Monotonic user aggregate version when present; consumers may ignore. */
  stateVersion?: number;
};

export type ServerConfigUpdatedPayload = {
  guildId: string;
};

export type ReportPendingPayload = {
  reportId: string;
  targetDiscordId: string;
  reporterDiscordId: string;
  guildId?: string | null;
  reason?: string;
};

export type GuildMembersSyncPayload = {
  guildId: string;
};

export type GuildDiscoveredPayload = {
  guildId: string;
  name: string | null;
  approximateMemberCount: number | null;
};

export function channelForEventType(type: DomainEventType): string {
  switch (type) {
    case 'user.flagged':
      return EVENT_CHANNELS.USER_FLAGGED;
    case 'user.reported':
      return EVENT_CHANNELS.USER_REPORTED;
    case 'user.updated':
      return EVENT_CHANNELS.USER_UPDATED;
    case 'server.config.updated':
      return EVENT_CHANNELS.SERVER_CONFIG_UPDATED;
    case 'report.pending':
      return EVENT_CHANNELS.REPORT_PENDING;
    case 'guild.members.sync':
      return EVENT_CHANNELS.GUILD_MEMBERS_SYNC;
    case 'guild.discovered':
      return EVENT_CHANNELS.GUILD_DISCOVERED;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function buildDomainEnvelope<T>(input: {
  outboxId: string;
  type: DomainEventType;
  occurredAt: Date;
  correlationId?: string | null;
  payload: T;
}): DomainEventEnvelope<T> {
  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    eventId: input.outboxId,
    type: input.type,
    occurredAt: input.occurredAt.toISOString(),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    payload: input.payload,
  };
}

export function isDomainEventType(s: string): s is DomainEventType {
  return (
    s === 'user.flagged' ||
    s === 'user.reported' ||
    s === 'user.updated' ||
    s === 'server.config.updated' ||
    s === 'report.pending' ||
    s === 'guild.members.sync' ||
    s === 'guild.discovered'
  );
}
