import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ApiClient } from '../services/apiClient';

export const reportCommandData = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Report a user to Protect')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) =>
    o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(2000),
  );

export async function executeReport(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
): Promise<void> {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);
  await interaction.deferReply({ ephemeral: true });
  if (!api.guildRate.tryConsume(interaction.guildId)) {
    await interaction.editReply({
      content: 'Rate limit: too many commands in this server. Try again shortly.',
    });
    return;
  }
  try {
    await api.postReport({
      reporterDiscordId: interaction.user.id,
      targetDiscordId: target.id,
      reason,
      guildId: interaction.guildId ?? undefined,
    });
    await interaction.editReply({
      content: `Report submitted for <@${target.id}>. Thank you.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ content: `Report failed: ${msg}` });
  }
}
