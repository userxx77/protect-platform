import type { Client, GuildMember } from 'discord.js';
import type { ApiClient } from '../services/apiClient';
import { alertEmbed, shouldAlert } from '../services/alerts';

export async function onGuildMemberAdd(
  member: GuildMember,
  api: ApiClient,
  client: Client,
): Promise<void> {
  if (!member.guild) return;
  try {
    const [user, server] = await Promise.all([
      api.getUser(member.id),
      api.getServer(member.guild.id),
    ]);
    const min = server.config.alertMinLevel;
    if (!server.config.alertChannelId || !shouldAlert(user.flagLevel, min)) {
      return;
    }
    const ch = await client.channels.fetch(server.config.alertChannelId);
    if (!ch || !('send' in ch)) return;
    const mentions =
      server.config.mentionRoleIds?.map((id) => `<@&${id}>`).join(' ') ?? '';
    await ch.send({
      content: mentions || undefined,
      embeds: [
        alertEmbed(
          user,
          `**${member.user.tag}** joined **${member.guild.name}** with elevated reputation.`,
        ),
      ],
    });
  } catch {
    /* non-fatal */
  }
}
