import type { Guild } from 'discord.js';
import type { ApiClient } from './apiClient';
import { botLog } from '../log';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Loads members into cache then uploads Discord user ids in chunks.
 * Very large guilds may take time; consider future REST pagination + `after` if needed.
 */
export async function syncGuildMembersToApi(guild: Guild, api: ApiClient): Promise<void> {
  try {
    await guild.members.fetch();
    const ids = [...guild.members.cache.keys()];
    const chunkSize = 400;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const slice = ids.slice(i, i + chunkSize);
      await api.postMembersBatch(guild.id, slice);
      await sleep(300);
    }

    await api.postMembersSyncDone(guild.id);
    botLog('info', 'guild_member_sync_complete', {
      guildId: guild.id,
      count: ids.length,
    });
  } catch (e) {
    botLog('error', 'guild_member_sync_failed', {
      guildId: guild.id,
      error: String(e).slice(0, 500),
    });
    try {
      await api.postMembersSyncDone(guild.id);
    } catch {
      /* ignore */
    }
  }
}
