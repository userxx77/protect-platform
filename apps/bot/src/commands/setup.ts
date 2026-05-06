import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import {
  embedNeedGuild,
  embedSetupAlerts,
  embedSetupPermissions,
  embedSetupReports,
  embedSetupStart,
} from '../embeds/commandEmbeds';

export const setupCommandData = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Guided server setup: alerts, reports, and permissions')
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('start')
      .setDescription('First-time checklist for enabling Sentra in this server'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('alerts')
      .setDescription('Configure staff alert channel and noise level'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reports')
      .setDescription('How community reports work and who can use them'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('permissions')
      .setDescription('Recommended bot permissions and staff requirements'),
  );

export async function executeSetup(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [embedNeedGuild()] });
    return;
  }

  const sub = interaction.options.getSubcommand(true);
  const guildName = interaction.guild?.name ?? 'this server';

  const embed =
    sub === 'start'
      ? embedSetupStart(guildName)
      : sub === 'alerts'
        ? embedSetupAlerts()
        : sub === 'reports'
          ? embedSetupReports()
          : embedSetupPermissions();

  await interaction.reply({ ephemeral: true, embeds: [embed] });
}
