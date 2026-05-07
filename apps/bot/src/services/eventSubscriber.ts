import Redis from 'ioredis';
import type { Client } from 'discord.js';

import { botLog } from '../log';
import type { ApiClient } from './apiClient';
import type { Env } from '../config/env';
import { syncGuildMembersToApi } from './memberSync';
import { sendAdminFeedEmbed } from './adminFeed';
import { pushGuildSnapshotToApi } from '../util/guildSnapshot';
import {
  embedGuildDiscovered,
  embedReportPending,
  embedSupportTicketAdmin,
  embedUnknownGuildSync,
} from '../embeds/sentra';

const CHANNELS = [
  'protect:user.flagged',
  'protect:user.reported',
  'protect:user.updated',
  'protect:server.config.updated',
  'protect:report.pending',
  'protect:guild.members.sync',
  'protect:guild.metadata.refresh',
  'protect:guild.discovered',
  'protect:support.ticket.created',
  'protect:support.ticket.evidence_submitted',
  'protect:support.ticket.resolved',
  'protect:flag.removed',
];

/** Envelope v1 from API/worker; older messages may omit schemaVersion / eventId. */
type EventEnvelope = {
  schemaVersion?: number;
  eventId?: string;
  type?: string;
  correlationId?: string;
  occurredAt?: string;
  payload: {
    guildId?: string | null;
    reportId?: string;
    targetDiscordId?: string;
    reporterDiscordId?: string;
    reason?: string;
    allegedFlagLevel?: string | null;
    name?: string | null;
    approximateMemberCount?: number | null;
  };
};

export function startEventSubscriber(
  redisUrl: string,
  api: ApiClient,
  client: Client,
  botEnv: Env,
  options?: { dedupe?: boolean },
): { stop: () => Promise<void> } {
  const sub = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  const dedupeClient =
    options?.dedupe === true
      ? new Redis(redisUrl, { maxRetriesPerRequest: 2 })
      : null;

  const onMessage = (_channel: string, message: string) => {
    void (async () => {
      try {
        const env = JSON.parse(message) as EventEnvelope;
        void env.schemaVersion;
        void env.correlationId;
        void env.occurredAt;

        botLog('info', 'bot_event_received', {
          eventId: env.eventId ?? null,
          type: env.type ?? null,
          guildId: env.payload?.guildId ?? null,
          correlationId: env.correlationId ?? null,
        });

        if (dedupeClient && env.eventId) {
          const first = await dedupeClient.set(
            `protect:subscriber:handled:${env.eventId}`,
            '1',
            'EX',
            86400,
            'NX',
          );
          if (first === null) {
            return;
          }
        }

        if (env.type === 'guild.members.sync') {
          const gid = env.payload?.guildId;
          if (gid) {
            let g = client.guilds.cache.get(gid);
            if (!g) {
              try {
                g = await client.guilds.fetch(gid);
              } catch {
                await sendAdminFeedEmbed(
                  client,
                  botEnv,
                  embedUnknownGuildSync({ guildId: gid }),
                );
                botLog('warn', 'member_sync_guild_fetch_failed', { guildId: gid });
                return;
              }
            }
            await syncGuildMembersToApi(g, api, client, botEnv);
          }
          return;
        }

        if (env.type === 'guild.metadata.refresh') {
          const gid = env.payload?.guildId;
          if (gid) {
            let g = client.guilds.cache.get(gid);
            if (!g) {
              try {
                g = await client.guilds.fetch(gid);
              } catch {
                botLog('warn', 'metadata_refresh_guild_fetch_failed', { guildId: gid });
                return;
              }
            }
            await pushGuildSnapshotToApi(g, api).catch((e) =>
              botLog('warn', 'metadata_refresh_snapshot_failed', {
                guildId: gid,
                error: e instanceof Error ? e.message : String(e),
              }),
            );
          }
          return;
        }

        if (env.type === 'report.pending') {
          const {
            reportId,
            targetDiscordId,
            reporterDiscordId,
            guildId,
            reason,
            allegedFlagLevel,
          } = env.payload;
          let guildName: string | null = null;
          let guildIconUrl: string | null = null;
          let targetMemberTag: string | null = null;
          let targetAvatarUrl: string | null = null;
          if (guildId) {
            let g = client.guilds.cache.get(guildId);
            if (!g) {
              try {
                g = await client.guilds.fetch(guildId);
              } catch {
                g = undefined;
              }
            }
            if (g) {
              guildName = g.name;
              guildIconUrl = g.iconURL({ size: 128 });
              if (targetDiscordId) {
                try {
                  const m = await g.members.fetch(targetDiscordId);
                  targetMemberTag = m.user.tag;
                  targetAvatarUrl = m.user.displayAvatarURL({ size: 128 });
                } catch {
                  /* cache miss / left server */
                }
              }
            }
          }
          await sendAdminFeedEmbed(
            client,
            botEnv,
            embedReportPending({
              reportId,
              targetDiscordId,
              reporterDiscordId,
              guildId: guildId ?? undefined,
              reason,
              allegedFlagLevel: allegedFlagLevel ?? null,
              guildName,
              guildIconUrl,
              targetMemberTag,
              targetAvatarUrl,
            }),
          );
          return;
        }

        if (
          env.type === 'support.ticket.created' ||
          env.type === 'support.ticket.evidence_submitted' ||
          env.type === 'support.ticket.resolved'
        ) {
          const p = env.payload as {
            ticketId?: string;
            reportId?: string;
            reporterDiscordId?: string;
            guildId?: string | null;
            status?: string;
            attachmentCount?: number;
            linkCount?: number;
          };
          await sendAdminFeedEmbed(
            client,
            botEnv,
            embedSupportTicketAdmin({
              kind: env.type,
              ticketId: p.ticketId,
              reportId: p.reportId,
              reporterDiscordId: p.reporterDiscordId,
              guildId: p.guildId,
              status: p.status,
              attachmentCount: p.attachmentCount,
              linkCount: p.linkCount,
            }),
          );
          return;
        }

        if (env.type === 'guild.discovered') {
          const { guildId, name, approximateMemberCount } = env.payload;
          const g = guildId ? client.guilds.cache.get(guildId) : undefined;
          await sendAdminFeedEmbed(
            client,
            botEnv,
            embedGuildDiscovered({
              guildId: guildId ?? '—',
              name: name ?? null,
              approximateMemberCount: approximateMemberCount ?? null,
              iconHash: g?.icon ?? null,
            }),
          );
          return;
        }

        const gid = env.payload?.guildId;
        if (env.type?.startsWith('user.') && !gid) {
          botLog('debug', 'bot_event_user_scope_no_guild_expected', {
            type: env.type,
          });
        }
        if (gid) {
          api.invalidateServerCache(gid);
        }
      } catch {
        /* ignore malformed */
      }
    })();
  };

  sub.on('message', onMessage);

  void sub
    .subscribe(...CHANNELS)
    .then(() => botLog('info', 'redis_event_subscriber_connected'))
    .catch((e) => botLog('error', 'redis_subscribe_failed', { error: String(e) }));

  return {
    stop: async () => {
      sub.off('message', onMessage);
      await sub.quit();
      await dedupeClient?.quit();
    },
  };
}
