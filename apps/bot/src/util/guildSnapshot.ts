import type { Guild } from 'discord.js';
import type { ApiClient } from '../services/apiClient';

export async function pushGuildSnapshotToApi(
  guild: Guild,
  api: ApiClient,
): Promise<void> {
  let ownerId = guild.ownerId;
  if (!ownerId) {
    try {
      const owner = await guild.fetchOwner();
      ownerId = owner.user?.id ?? null;
    } catch {
      ownerId = null;
    }
  }
  await api.postGuildSnapshot({
    guildId: guild.id,
    discordName: guild.name,
    iconHash: guild.icon,
    approximateMemberCount: guild.approximateMemberCount ?? guild.memberCount,
    ownerDiscordId: ownerId,
    vanityUrlCode: guild.vanityURLCode,
    premiumTier: guild.premiumTier,
  });
}
