import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js';
import type { ApiClient } from '../services/apiClient';
import { alertEmbed, shouldAlert, userStatusEmbed } from '../services/alerts';

export const checkCommandData = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Look up a user reputation')
  .addUserOption((o) =>
    o.setName('user').setDescription('Discord user').setRequired(true),
  );

export async function executeCheck(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
  client: Client,
): Promise<void> {
  const target = interaction.options.getUser('user', true);
  await interaction.deferReply({ ephemeral: true });
  if (!api.guildRate.tryConsume(interaction.guildId)) {
    await interaction.editReply({
      content: 'Rate limit: too many commands in this server. Try again shortly.',
    });
    return;
  }
  try {
    const u = await api.getUser(target.id);
    const embed = userStatusEmbed(u, 'Protect — user check');
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
    await interaction.editReply({ content: `Lookup failed: ${msg}` });
  }
}
