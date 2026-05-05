import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { ApiClient } from '../services/apiClient';
import {
  embedConfigBadChannel,
  embedConfigFailed,
  embedConfigLoadFailed,
  embedConfigNeedOptions,
  embedConfigSaved,
  embedConfigView,
  embedNeedGuild,
  embedNeedManageServer,
  embedRateLimited,
} from '../embeds/commandEmbeds';

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
    await interaction.reply({ ephemeral: true, embeds: [embedNeedGuild()] });
    return;
  }
  if (!canManageConfig(interaction)) {
    await interaction.reply({
      ephemeral: true,
      embeds: [embedNeedManageServer()],
    });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  if (!api.guildRate.tryConsume(interaction.guildId)) {
    await interaction.editReply({ embeds: [embedRateLimited()] });
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
    const updatedNote = s.updatedAt
      ? `_Updated ${s.updatedAt}_`
      : '_No saved config yet_';
    await interaction.editReply({
      embeds: [
        embedConfigView({
          alertChannel: ch,
          minLevel: min,
          mentionRoles: roles,
          updatedNote,
        }),
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ embeds: [embedConfigLoadFailed(msg)] });
  }
}

export async function executeConfigSet(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [embedNeedGuild()] });
    return;
  }
  if (!canManageConfig(interaction)) {
    await interaction.reply({
      ephemeral: true,
      embeds: [embedNeedManageServer()],
    });
    return;
  }

  const channel = interaction.options.getChannel('channel');
  const minlevel = interaction.options.getString('minlevel');

  if (!channel && !minlevel) {
    await interaction.reply({
      ephemeral: true,
      embeds: [embedConfigNeedOptions()],
    });
    return;
  }

  if (channel && !isAllowedAlertChannelType(channel.type)) {
    await interaction.reply({
      ephemeral: true,
      embeds: [embedConfigBadChannel()],
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  if (!api.guildRate.tryConsume(interaction.guildId)) {
    await interaction.editReply({ embeds: [embedRateLimited()] });
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
    await interaction.editReply({ embeds: [embedConfigSaved()] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await interaction.editReply({ embeds: [embedConfigFailed(msg)] });
  }
}
