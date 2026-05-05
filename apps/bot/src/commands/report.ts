import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ApiClient } from '../services/apiClient';
import type { Env } from '../config/env';
import {
  embedReportFailed,
  embedReportLicenseDenied,
  embedReportSuccessInstant,
  embedReportSuccessPending,
  embedRateLimited,
  isReportLicenseForbiddenError,
} from '../embeds/commandEmbeds';

export const reportCommandData = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Report a user to Sentra')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) =>
    o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(2000),
  );

function dashboardUrlEnv(env: Env): string | undefined {
  const w = env.WEB_URL?.replace(/\/$/, '');
  return w || undefined;
}

export async function executeReport(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
  env: Env,
): Promise<void> {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);
  await interaction.deferReply({ ephemeral: true });
  if (!api.guildRate.tryConsume(interaction.guildId)) {
    await interaction.editReply({ embeds: [embedRateLimited()] });
    return;
  }
  try {
    const data = (await api.postReport({
      reporterDiscordId: interaction.user.id,
      targetDiscordId: target.id,
      reason,
      guildId: interaction.guildId ?? undefined,
    })) as { pendingReview?: boolean };
    if (data && typeof data === 'object' && data.pendingReview === true) {
      await interaction.editReply({ embeds: [embedReportSuccessPending()] });
      return;
    }
    await interaction.editReply({ embeds: [embedReportSuccessInstant(target.id)] });
  } catch (e) {
    if (isReportLicenseForbiddenError(e)) {
      await interaction.editReply({
        embeds: [embedReportLicenseDenied(dashboardUrlEnv(env))],
      });
      return;
    }
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ embeds: [embedReportFailed(msg)] });
  }
}
