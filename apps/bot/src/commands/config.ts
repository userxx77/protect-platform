import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { ApiClient } from '../services/apiClient';

export const configCommandData = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Alert settings for this server (Manage Server)')
  .addSubcommand((sub) =>
    sub.setName('view').setDescription('Show current alert settings'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set alert channel and/or minimum flag level')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel for join/check alerts')
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildForum,
          )
          .setRequired(false),
      )
      .addStringOption((o) =>
        o
          .setName('minlevel')
          .setDescription('Minimum flag level to trigger alerts')
          .setRequired(false)
          .addChoices(
            { name: 'CLEAN', value: 'CLEAN' },
            { name: 'SUSPICIOUS', value: 'SUSPICIOUS' },
            { name: 'HIGH_RISK', value: 'HIGH_RISK' },
            { name: 'CONFIRMED_CHEATER', value: 'CONFIRMED_CHEATER' },
          ),
      ),
  );

function canManageConfig(interaction: ChatInputCommandInteraction): boolean {
  const m = interaction.memberPermissions;
  if (!m) return false;
  return (
    m.has(PermissionFlagsBits.Administrator) ||
    m.has(PermissionFlagsBits.ManageGuild)
  );
}

function isAllowedAlertChannelType(type: number): boolean {
  return (
    type === ChannelType.GuildText ||
    type === ChannelType.GuildAnnouncement ||
    type === ChannelType.GuildForum
  );
}

export async function executeConfigView(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      ephemeral: true,
      content: 'Use this command in a server.',
    });
    return;
  }
  if (!canManageConfig(interaction)) {
    await interaction.reply({
      ephemeral: true,
      content: 'You need **Manage Server** or **Administrator**.',
    });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  if (!api.guildRate.tryConsume(interaction.guildId)) {
    await interaction.editReply({
      content: 'Rate limit: try again shortly.',
    });
    return;
  }
  try {
    const s = await api.getServer(interaction.guildId);
    const cfg = s.config as Record<string, unknown>;
    const ch =
      typeof cfg.alertChannelId === 'string' ? cfg.alertChannelId : '—';
    const min =
      typeof cfg.alertMinLevel === 'string' ? cfg.alertMinLevel : '—';
    const roles = Array.isArray(cfg.mentionRoleIds)
      ? (cfg.mentionRoleIds as string[]).join(', ') || '—'
      : '—';
    await interaction.editReply({
      content: [
        `**Alert channel:** ${ch}`,
        `**Min level:** ${min}`,
        `**Mention roles:** ${roles}`,
        s.updatedAt ? `_Updated ${s.updatedAt}_` : '_No saved config yet_',
      ].join('\n'),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ content: `Could not load config: ${msg}` });
  }
}

export async function executeConfigSet(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      ephemeral: true,
      content: 'Use this command in a server.',
    });
    return;
  }
  if (!canManageConfig(interaction)) {
    await interaction.reply({
      ephemeral: true,
      content: 'You need **Manage Server** or **Administrator**.',
    });
    return;
  }

  const channel = interaction.options.getChannel('channel');
  const minlevel = interaction.options.getString('minlevel');

  if (!channel && !minlevel) {
    await interaction.reply({
      ephemeral: true,
      content: 'Provide at least one of **channel** or **minlevel**.',
    });
    return;
  }

  if (channel && !isAllowedAlertChannelType(channel.type)) {
    await interaction.reply({
      ephemeral: true,
      content: 'Pick a text, announcement, or forum channel.',
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  if (!api.guildRate.tryConsume(interaction.guildId)) {
    await interaction.editReply({
      content: 'Rate limit: try again shortly.',
    });
    return;
  }

  const config: { alertChannelId?: string; alertMinLevel?: string } = {};
  if (channel && isAllowedAlertChannelType(channel.type)) {
    config.alertChannelId = channel.id;
  }
  if (minlevel) {
    config.alertMinLevel = minlevel;
  }

  try {
    await api.postBotServerConfig({
      guildId: interaction.guildId,
      actorDiscordId: interaction.user.id,
      config,
    });
    await interaction.editReply({
      content: 'Settings saved. Alerts will use the new channel and/or level.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ content: `Save failed: ${msg}` });
  }
}
