import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { discordSlashLevelChoices, flagLevelDisplayName } from '@protect/shared';
import type { ApiClient } from '../services/apiClient';
import type { Env } from '../config/env';
import {
  embedReportCommunityRoleDenied,
  embedReportFailed,
  embedReportLicenseDenied,
  embedReportSuccessInstant,
  embedReportSuccessPending,
  embedNeedGuild,
  embedRateLimited,
  isReportCommunityRoleForbiddenError,
  isReportLicenseForbiddenError,
} from '../embeds/commandEmbeds';

export const reportCommandData = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Submit a community report for staff review')
  .setDMPermission(false)
  .addUserOption((o) =>
    o.setName('user').setDescription('Member to report').setRequired(true),
  )
  .addStringOption((o) =>
    o
      .setName('level')
      .setDescription('How serious is this report?')
      .setRequired(true)
      .addChoices(...discordSlashLevelChoices.map((c) => ({ name: c.name, value: c.value }))),
  )
  .addStringOption((o) =>
    o
      .setName('reason')
      .setDescription('Clear summary for moderators (facts, not pings)')
      .setRequired(true)
      .setMaxLength(2000),
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
    const caps = await api.getDiscordCapabilities(interaction.user.id);
    if (!caps.canSubmitCommunityReport) {
      await interaction.editReply({
        embeds: [embedReportCommunityRoleDenied(dashboardUrlEnv(env))],
      });
      return;
    }
    const data = (await api.postReport({
      reporterDiscordId: interaction.user.id,
      targetDiscordId: target.id,
      reason,
      guildId: interaction.guildId ?? undefined,
      allegedFlagLevel: level,
    })) as { pendingReview?: boolean; allegedFlagLevel?: string | null };
    const levelLabel = flagLevelDisplayName(data?.allegedFlagLevel ?? level);
    if (data && typeof data === 'object' && data.pendingReview === true) {
      await interaction.editReply({ embeds: [embedReportSuccessPending(levelLabel, target)] });
      return;
    }
    await interaction.editReply({ embeds: [embedReportSuccessInstant(target, levelLabel)] });
  } catch (e) {
    if (isReportLicenseForbiddenError(e)) {
      await interaction.editReply({
        embeds: [embedReportLicenseDenied(dashboardUrlEnv(env))],
      });
      return;
    }
    if (isReportCommunityRoleForbiddenError(e)) {
      await interaction.editReply({
        embeds: [embedReportCommunityRoleDenied(dashboardUrlEnv(env))],
      });
      return;
    }
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ embeds: [embedReportFailed(msg)] });
  }
}
