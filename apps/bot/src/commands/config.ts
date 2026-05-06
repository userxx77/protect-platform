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
import { displayFlagLevel } from '../services/joinHold';

const levelChoices = [
  { name: 'CLEAN', value: 'CLEAN' },
  { name: 'SUSPICIOUS', value: 'SUSPICIOUS' },
  { name: 'HIGH_RISK', value: 'HIGH_RISK' },
  { name: 'CONFIRMED_CHEATER', value: 'CONFIRMED_CHEATER' },
] as const;

export const configCommandData = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Staff alerts and join hold (requires Manage Server)')
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('Show saved alert and join hold settings'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Update alert channel, levels, or join hold options')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel where Sentra posts join and check alerts')
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
          .setDescription('Minimum reputation level that triggers an alert')
          .setRequired(false)
          .addChoices(...levelChoices),
      )
      .addBooleanOption((o) =>
        o
          .setName('joinhold_enabled')
          .setDescription(
            'Join hold: timeout + Kick/Ban/Release card (independent of alert level)',
          )
          .setRequired(false),
      )
      .addIntegerOption((o) =>
        o
          .setName('joinhold_minutes')
          .setDescription('Communication timeout length in minutes (1–40320)')
          .setMinValue(1)
          .setMaxValue(40320)
          .setRequired(false),
      )
      .addStringOption((o) =>
        o
          .setName('joinhold_minlevel')
          .setDescription(
            'Minimum Sentra level to apply join hold (below = no timeout/card)',
          )
          .setRequired(false)
          .addChoices(...levelChoices),
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
    const minDisplay =
      typeof cfg.alertMinLevel === 'string'
        ? `${cfg.alertMinLevel} (${displayFlagLevel(cfg.alertMinLevel)})`
        : '—';
    const roles = Array.isArray(cfg.mentionRoleIds)
      ? (cfg.mentionRoleIds as string[]).join(', ') || '—'
      : '—';

    const jhOn =
      typeof cfg.joinHoldEnabled === 'boolean' ? cfg.joinHoldEnabled : false;
    const jhMinRaw =
      typeof cfg.joinHoldMinLevel === 'string' ? cfg.joinHoldMinLevel : null;
    const jhMinDisplay = jhMinRaw
      ? `${jhMinRaw} (${displayFlagLevel(jhMinRaw)})`
      : `SUSPICIOUS (${displayFlagLevel('SUSPICIOUS')}) — default`;
    const jhMinutes =
      typeof cfg.joinHoldDurationMinutes === 'number'
        ? String(cfg.joinHoldDurationMinutes)
        : '60 — default when hold is on';

    const updatedNote = s.updatedAt
      ? `_Updated ${s.updatedAt}_`
      : '_No saved config yet_';
    await interaction.editReply({
      embeds: [
        embedConfigView({
          alertChannel: ch,
          minLevel: minDisplay,
          mentionRoles: roles,
          joinHoldEnabled: jhOn ? 'On' : 'Off',
          joinHoldMinutes: jhMinutes,
          joinHoldMinLevel: jhMinDisplay,
          updatedNote,
        })],
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
  const joinholdEnabled = interaction.options.getBoolean('joinhold_enabled');
  const joinholdMinutes = interaction.options.getInteger('joinhold_minutes');
  const joinholdMinLevel = interaction.options.getString('joinhold_minlevel');

  if (
    !channel &&
    !minlevel &&
    joinholdEnabled === null &&
    joinholdMinutes === null &&
    !joinholdMinLevel
  ) {
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

  const config: Record<string, unknown> = {};
  if (channel && isAllowedAlertChannelType(channel.type)) {
    config.alertChannelId = channel.id;
  }
  if (minlevel) {
    config.alertMinLevel = minlevel;
  }
  if (joinholdEnabled !== null) {
    config.joinHoldEnabled = joinholdEnabled;
  }
  if (joinholdMinutes !== null) {
    config.joinHoldDurationMinutes = joinholdMinutes;
  }
  if (joinholdMinLevel) {
    config.joinHoldMinLevel = joinholdMinLevel;
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
