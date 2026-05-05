import Redis from 'ioredis';
import type { Client } from 'discord.js';

import { botLog } from '../log';
import type { ApiClient } from './apiClient';
import type { Env } from '../config/env';
import { syncGuildMembersToApi } from './memberSync';
import { sendAdminFeedMessage } from './adminFeed';

const CHANNELS = [
  'protect:user.flagged',
  'protect:user.reported',
  'protect:user.updated',
  'protect:server.config.updated',
  'protect:report.pending',
  'protect:guild.members.sync',
  'protect:guild.discovered',
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
            const g = client.guilds.cache.get(gid);
            if (g) {
              await syncGuildMembersToApi(g, api);
            } else {
              botLog('warn', 'member_sync_guild_not_cached', { guildId: gid });
            }
          }
          return;
        }

        if (env.type === 'report.pending') {
          const { reportId, targetDiscordId, reporterDiscordId, guildId } = env.payload;
          await sendAdminFeedMessage(
            client,
            botEnv,
            'Report pending review',
            [
              `Report **${reportId ?? '—'}**`,
              `Target: <@${targetDiscordId ?? '0'}> (\`${targetDiscordId ?? '—'}\`)`,
              `Reporter: <@${reporterDiscordId ?? '0'}>`,
              guildId ? `Guild: \`${guildId}\`` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          );
          return;
        }

        if (env.type === 'guild.discovered') {
          const { guildId, name, approximateMemberCount } = env.payload;
          await sendAdminFeedMessage(
            client,
            botEnv,
            'Bot joined a server',
            [
              `**${name ?? 'Unknown guild'}**`,
              guildId ? `ID: \`${guildId}\`` : '',
              approximateMemberCount != null
                ? `~${approximateMemberCount} members`
                : '',
            ]
              .filter(Boolean)
              .join('\n'),
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
