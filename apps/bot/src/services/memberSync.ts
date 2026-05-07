import type { Guild } from 'discord.js';
import type { ApiClient } from './apiClient';
import type { Client } from 'discord.js';
import type { Env } from '../config/env';
import { botLog } from '../log';
import {
  embedMemberSyncCompleted,
  embedMemberSyncFailed,
  embedMemberSyncStarted,
} from '../embeds/sentra';
import { sendAdminFeedEmbed } from './adminFeed';
import { userStatusEmbed } from './alerts';
import { pushGuildSnapshotToApi } from '../util/guildSnapshot';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const POST_SYNC_ALERT_CAP = 35;
const ELEVATION_SCAN_CHUNK = 500;

export type MemberProfileRow = {
  discordUserId: string;
  username?: string | null;
  globalName?: string | null;
  avatarHash?: string | null;
};

/** After a full member sync, post alerts for accounts at/above the server alert threshold. */
async function postSyncElevationAlerts(
  guild: Guild,
  api: ApiClient,
  client: Client,
  memberDiscordIds: string[],
): Promise<void> {
  if (memberDiscordIds.length === 0) return;
  try {
    const server = await api.getServer(guild.id);
    const cfg = server.config as {
      alertChannelId?: string;
      alertMinLevel?: string;
      mentionRoleIds?: string[];
    };
    const chId = cfg.alertChannelId;
    if (!chId) return;

    const ch = await client.channels.fetch(chId);
    if (!ch || !('send' in ch)) return;

    const minLevel = cfg.alertMinLevel;
    const mentions = cfg.mentionRoleIds?.map((id) => `<@&${id}>`).join(' ') ?? '';

    let sent = 0;
    let first = true;
    for (let i = 0; i < memberDiscordIds.length; i += ELEVATION_SCAN_CHUNK) {
      const chunk = memberDiscordIds.slice(i, i + ELEVATION_SCAN_CHUNK);
      const { hits } = await api.postGuildElevationScan(guild.id, {
        discordIds: chunk,
        alertMinLevel: minLevel,
      });
      for (const u of hits) {
        if (sent >= POST_SYNC_ALERT_CAP) break;
        const pub = {
          discordId: u.discordId,
          flagLevel: u.flagLevel,
          flagScore: u.flagScore,
          flagCount: u.flagCount,
        };
        await ch.send({
          content: first && mentions ? mentions : undefined,
          embeds: [userStatusEmbed(pub, '📋 Server scan · verhoogd risico')],
        });
        first = false;
        sent += 1;
        await sleep(650);
      }
      if (sent >= POST_SYNC_ALERT_CAP) break;
    }

    if (sent >= POST_SYNC_ALERT_CAP) {
      await ch.send({
        content:
          '📋 **Sentra:** Maximaal aantal scan-meldingen bereikt — bekijk het dashboard voor alle hits.',
      });
    }
  } catch (e) {
    botLog('warn', 'post_sync_elevation_alerts_failed', {
      guildId: guild.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Loads members into cache then uploads profiles in chunks.
 */
export async function syncGuildMembersToApi(
  guild: Guild,
  api: ApiClient,
  client: Client,
  botEnv: Env,
): Promise<void> {
  await sendAdminFeedEmbed(
    client,
    botEnv,
    embedMemberSyncStarted({
      guildId: guild.id,
      guildName: guild.name,
      iconHash: guild.icon,
    }),
  );

  try {
    await guild.members.fetch();
    await pushGuildSnapshotToApi(guild, api).catch((e) =>
      botLog('warn', 'guild_snapshot_after_fetch_failed', {
        guildId: guild.id,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    const members = [...guild.members.cache.values()];
    const rows: MemberProfileRow[] = await Promise.all(
      members.map(async (m) => {
        let user = m.user;
        if (user.partial) {
          try {
            user = await user.fetch();
          } catch {
            /* keep partial user; avatar may be missing */
          }
        }
        return {
          discordUserId: m.id,
          username: user.username,
          globalName: user.globalName ?? null,
          avatarHash: user.avatar,
        };
      }),
    );
    const chunkSize = 400;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      await api.postMembersBatch(guild.id, slice);
      await sleep(300);
    }

    const memberIds = rows.map((r) => r.discordUserId);
    await postSyncElevationAlerts(guild, api, client, memberIds);

    await api.postMembersSyncDone(guild.id);
    botLog('info', 'guild_member_sync_complete', {
      guildId: guild.id,
      count: rows.length,
    });
    await sendAdminFeedEmbed(
      client,
      botEnv,
      embedMemberSyncCompleted({
        guildId: guild.id,
        guildName: guild.name,
        memberCount: rows.length,
        iconHash: guild.icon,
      }),
    );
  } catch (e) {
    const err = String(e).slice(0, 500);
    botLog('error', 'guild_member_sync_failed', {
      guildId: guild.id,
      error: err,
    });
    await sendAdminFeedEmbed(
      client,
      botEnv,
      embedMemberSyncFailed({
        guildId: guild.id,
        guildName: guild.name,
        error: err,
        iconHash: guild.icon,
      }),
    );
    try {
      await api.postMembersSyncDone(guild.id);
    } catch {
      /* ignore */
    }
  }
}
