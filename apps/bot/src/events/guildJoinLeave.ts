import type { Guild } from 'discord.js';
import type { ApiClient } from '../services/apiClient';

export async function onGuildJoined(guild: Guild, api: ApiClient): Promise<void> {
  await api.postGuildLifecycle({
    guildId: guild.id,
    event: 'join',
    discordName: guild.name,
    iconHash: guild.icon,
    approximateMemberCount: guild.memberCount,
  });
}

export async function onGuildRemoved(guild: Guild, api: ApiClient): Promise<void> {
  await api.postGuildLifecycle({
    guildId: guild.id,
    event: 'leave',
    discordName: guild.name,
    iconHash: guild.icon,
    approximateMemberCount: guild.memberCount,
  });
}
