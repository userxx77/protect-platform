import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ApiClient } from '../services/apiClient';
import { embedFlagFailed, embedFlagSuccess, embedRateLimited } from '../embeds/commandEmbeds';

export const flagCommandData = new SlashCommandBuilder()
  .setName('flag')
  .setDescription('Apply a weighted flag (trusted users only — enforced by the API)')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) =>
    o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(2000),
  );

export async function executeFlag(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
): Promise<void> {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);
  await interaction.deferReply({ ephemeral: true });
  if (!api.guildRate.tryConsume(interaction.guildId)) {
    await interaction.editReply({ embeds: [embedRateLimited()] });
    return;
  }
  try {
    const result = (await api.postFlag({
      targetDiscordId: target.id,
      actorDiscordId: interaction.user.id,
      reason,
      guildId: interaction.guildId ?? undefined,
    })) as {
      flagLevel?: string;
      flagScore?: number;
      weightApplied?: number;
    };
    await interaction.editReply({
      embeds: [
        embedFlagSuccess({
          flagLevel: result.flagLevel ?? '?',
          flagScore: result.flagScore ?? 0,
          weightApplied: result.weightApplied ?? '?',
        }),
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ embeds: [embedFlagFailed(msg)] });
  }
}
