import type { Guild } from 'discord.js';
import type { ApiClient } from '../services/apiClient';
import { botLog } from '../log';

export async function onGuildJoined(guild: Guild, api: ApiClient): Promise<void> {
  let blacklisted = false;
  try {
    const summary = await api.getGuildLicenseSummary(guild.id);
    blacklisted = summary.blacklisted === true;
  } catch (e) {
    botLog('warn', 'guild_join_summary_failed', {
      guildId: guild.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  if (blacklisted) {
    botLog('warn', 'guild_blacklisted_leaving', { guildId: guild.id });
    await guild.leave();
    return;
  }
  await api.postGuildLifecycle({
    guildId: guild.id,
    event: 'join',
    discordName: guild.name,
    iconHash: guild.icon,
    approximateMemberCount: guild.memberCount,
    ownerDiscordId: guild.ownerId,
    vanityUrlCode: guild.vanityURLCode,
    premiumTier: guild.premiumTier,
  });
}

export async function onGuildRemoved(guild: Guild, api: ApiClient): Promise<void> {
  await api.postGuildLifecycle({
    guildId: guild.id,
    event: 'leave',
    discordName: guild.name,
    iconHash: guild.icon,
    approximateMemberCount: guild.memberCount,
    ownerDiscordId: guild.ownerId,
    vanityUrlCode: guild.vanityURLCode,
    premiumTier: guild.premiumTier,
  });
}
