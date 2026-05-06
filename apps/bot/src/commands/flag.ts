import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { discordSlashLevelChoices, flagLevelDisplayName } from '@protect/shared';
import type { ApiClient } from '../services/apiClient';
import { embedFlagFailed, embedFlagSuccess, embedNeedGuild, embedRateLimited } from '../embeds/commandEmbeds';

export const flagCommandData = new SlashCommandBuilder()
  .setName('flag')
  .setDescription('Trusted reporters: apply a weighted flag (API-enforced)')
  .setDMPermission(false)
  .addUserOption((o) => o.setName('user').setDescription('Member to flag').setRequired(true))
  .addStringOption((o) =>
    o
      .setName('level')
      .setDescription('Severity tier for this flag')
      .setRequired(true)
      .addChoices(...discordSlashLevelChoices.map((c) => ({ name: c.name, value: c.value }))),
  )
  .addStringOption((o) =>
    o
      .setName('reason')
      .setDescription('Why this flag is warranted')
      .setRequired(true)
      .setMaxLength(2000),
  );

export async function executeFlag(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [embedNeedGuild()] });
    return;
  }
  const target = interaction.options.getUser('user', true);
  const level = interaction.options.getString('level', true);
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
      severity: level,
    })) as {
      flagLevel?: string;
      flagScore?: number;
      weightApplied?: number;
    };
    await interaction.editReply({
      embeds: [
        embedFlagSuccess({
          flagLevel: flagLevelDisplayName(result.flagLevel ?? '?'),
          flagScore: result.flagScore ?? 0,
          weightApplied: result.weightApplied ?? '?',
          severityLabel: flagLevelDisplayName(level),
        }),
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ embeds: [embedFlagFailed(msg)] });
  }
}
