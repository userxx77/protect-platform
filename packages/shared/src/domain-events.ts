/** Redis pub/sub channel names */
export const EVENT_CHANNELS = {
  USER_FLAGGED: 'protect:user.flagged',
  USER_REPORTED: 'protect:user.reported',
  USER_UPDATED: 'protect:user.updated',
  SERVER_CONFIG_UPDATED: 'protect:server.config.updated',
  REPORT_PENDING: 'protect:report.pending',
  GUILD_MEMBERS_SYNC: 'protect:guild.members.sync',
  GUILD_DISCOVERED: 'protect:guild.discovered',
  SUPPORT_TICKET_CREATED: 'protect:support.ticket.created',
  SUPPORT_TICKET_EVIDENCE_SUBMITTED: 'protect:support.ticket.evidence_submitted',
  SUPPORT_TICKET_RESOLVED: 'protect:support.ticket.resolved',
  FLAG_REMOVED: 'protect:flag.removed',
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
  | 'guild.discovered'
  | 'support.ticket.created'
  | 'support.ticket.evidence_submitted'
  | 'support.ticket.resolved'
  | 'flag.removed';

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

export type SupportTicketCreatedPayload = {
  ticketId: string;
  reportId: string;
  reporterDiscordId: string;
  guildId?: string | null;
  status: string;
};

export type SupportTicketEvidenceSubmittedPayload = {
  ticketId: string;
  reportId: string;
  reporterDiscordId: string;
  attachmentCount: number;
  linkCount: number;
};

export type SupportTicketResolvedPayload = {
  ticketId: string;
  reportId: string;
  reporterDiscordId: string;
  status: string;
};

export type FlagRemovedPayload = {
  discordId: string;
  flagId: string;
  actorDiscordId: string;
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
    case 'support.ticket.created':
      return EVENT_CHANNELS.SUPPORT_TICKET_CREATED;
    case 'support.ticket.evidence_submitted':
      return EVENT_CHANNELS.SUPPORT_TICKET_EVIDENCE_SUBMITTED;
    case 'support.ticket.resolved':
      return EVENT_CHANNELS.SUPPORT_TICKET_RESOLVED;
    case 'flag.removed':
      return EVENT_CHANNELS.FLAG_REMOVED;
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
    s === 'guild.discovered' ||
    s === 'support.ticket.created' ||
    s === 'support.ticket.evidence_submitted' ||
    s === 'support.ticket.resolved' ||
    s === 'flag.removed'
  );
}

/** Exact API 403 message for community /report when reporter lacks USER/ADMIN platform role. */
export const COMMUNITY_REPORT_REQUIRES_USER_ROLE_MESSAGE =
  'Community reports require a dashboard account with the User role. A platform admin can promote your account in Sentra.';
