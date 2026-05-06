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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type MemberProfileRow = {
  discordUserId: string;
  username?: string | null;
  globalName?: string | null;
  avatarHash?: string | null;
};

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
