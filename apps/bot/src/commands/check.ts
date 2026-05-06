import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js';
import type { ApiClient } from '../services/apiClient';
import { alertEmbed, shouldAlert, userStatusEmbed } from '../services/alerts';
import { embedCheckFailed, embedRateLimited } from '../embeds/commandEmbeds';

export const checkCommandData = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Look up Sentra reputation for a member')
  .setDMPermission(false)
  .addUserOption((o) =>
    o.setName('user').setDescription('Member to look up').setRequired(true),
  );

export async function executeCheck(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
  client: Client,
): Promise<void> {
  const target = interaction.options.getUser('user', true);
  await interaction.deferReply({ ephemeral: true });
  if (!api.guildRate.tryConsume(interaction.guildId)) {
    await interaction.editReply({ embeds: [embedRateLimited()] });
    return;
  }
  try {
    const u = await api.getUser(target.id);
    const embed = userStatusEmbed(u, 'Reputation check');
    await interaction.editReply({ embeds: [embed] });
    void api.postIncrementCheckCounter().catch(() => undefined);

    if (!interaction.guildId) return;

    try {
      const server = await api.getServer(interaction.guildId);
      const min = server.config.alertMinLevel;
      if (
        server.config.alertChannelId &&
        shouldAlert(u.flagLevel, min)
      ) {
        const ch = await client.channels.fetch(server.config.alertChannelId);
        if (ch && 'send' in ch) {
          await ch.send({
            embeds: [
              alertEmbed(
                u,
                `Manual check by ${interaction.user.tag} in ${interaction.guild?.name ?? 'guild'}`,
              ),
            ],
          });
        }
      }
    } catch {
      /* optional alert channel */
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ embeds: [embedCheckFailed(msg)] });
  }
}
