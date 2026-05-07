import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { isDiscordPlatformAdmin } from '@protect/shared';
import type { Env } from '../config/env';
import { SENTRA_DANGER, baseCommandEmbed } from '../embeds/sentra';
import { embedMonitorHelp, embedOperatorsOnly } from '../embeds/commandEmbeds';

export const sentraCommandData = new SlashCommandBuilder()
  .setName('sentra')
  .setDescription('Platform operator utilities')
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('monitor')
      .setDescription('Stream the live Redis event log from your application server'),
  );

export async function executeSentra(
  interaction: ChatInputCommandInteraction,
  env: Env,
): Promise<void> {
  const sub = interaction.options.getSubcommand(true);
  if (sub !== 'monitor') {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        baseCommandEmbed(SENTRA_DANGER)
          .setTitle('Unknown')
          .setDescription('Use `/sentra monitor`.'),
      ],
    });
    return;
  }

  if (!isDiscordPlatformAdmin(interaction.user.id, env.ADMIN_DISCORD_IDS)) {
    await interaction.reply({
      ephemeral: true,
      embeds: [embedOperatorsOnly()],
    });
    return;
  }

  const dash = env.WEB_URL?.replace(/\/$/, '') ?? 'your dashboard';
  await interaction.reply({
    ephemeral: true,
    embeds: [
      embedMonitorHelp({
        dashboardHint: dash,
        opsKeyHint:
          'Set `SENTRA_OPS_STATS_KEY` in API `.env` (same value everywhere) so the stats footer on the CLI can call `/v1/public/platform-stats`.',
      }),
    ],
  });
}
