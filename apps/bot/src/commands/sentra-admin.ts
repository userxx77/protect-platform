import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { isDiscordPlatformAdmin } from '@protect/shared';
import type { ApiClient } from '../services/apiClient';
import type { Env } from '../config/env';
import {
  embedPlatformAdminOnly,
  embedSentraAdminError,
  embedSentraAdminLicenseOk,
  embedSentraAdminSyncQueued,
} from '../embeds/commandEmbeds';

export const sentraAdminCommandData = new SlashCommandBuilder()
  .setName('sentra-admin')
  .setDescription('Platform admins: server licenses and member sync jobs')
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('license')
      .setDescription('Create or update a server license (entitlement)')
      .addStringOption((o) =>
        o
          .setName('guild_id')
          .setDescription('Discord server (guild) snowflake ID')
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('status')
          .setDescription('License status to apply')
          .setRequired(true)
          .addChoices(
            { name: 'Inactive', value: 'INACTIVE' },
            { name: 'Trial', value: 'TRIAL' },
            { name: 'Active', value: 'ACTIVE' },
            { name: 'Past due', value: 'PAST_DUE' },
            { name: 'Canceled', value: 'CANCELED' },
          ),
      )
      .addStringOption((o) =>
        o
          .setName('valid_from')
          .setDescription('Start date YYYY-MM-DD (UTC midnight); default today')
          .setRequired(false),
      )
      .addStringOption((o) =>
        o
          .setName('valid_until')
          .setDescription('Optional end date YYYY-MM-DD (UTC midnight)')
          .setRequired(false),
      )
      .addStringOption((o) =>
        o
          .setName('plan_code')
          .setDescription('Optional plan label (e.g. pro)')
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('sync-members')
      .setDescription('Queue a full member cache sync for a server')
      .addStringOption((o) =>
        o
          .setName('guild_id')
          .setDescription('Discord server snowflake ID')
          .setRequired(true),
      ),
  );

export async function executeSentraAdmin(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
  env: Env,
): Promise<void> {
  if (!isDiscordPlatformAdmin(interaction.user.id, env.ADMIN_DISCORD_IDS)) {
    await interaction.reply({
      ephemeral: true,
      embeds: [embedPlatformAdminOnly()],
    });
    return;
  }

  const sub = interaction.options.getSubcommand(true);
  await interaction.deferReply({ ephemeral: true });

  try {
    if (sub === 'license') {
      const guildId = interaction.options.getString('guild_id', true);
      const status = interaction.options.getString('status', true);
      const validFromDay =
        interaction.options.getString('valid_from') ??
        new Date().toISOString().slice(0, 10);
      const validFrom = `${validFromDay}T00:00:00.000Z`;
      const untilDay = interaction.options.getString('valid_until');
      const validUntil =
        untilDay === null || untilDay === ''
          ? null
          : `${untilDay}T23:59:59.999Z`;
      const planCode = interaction.options.getString('plan_code');

      await api.postBotAdminEntitlement(guildId, interaction.user.id, {
        status,
        validFrom,
        validUntil,
        planCode: planCode || undefined,
      });
      await interaction.editReply({
        embeds: [embedSentraAdminLicenseOk(guildId, status)],
      });
      return;
    }

    if (sub === 'sync-members') {
      const guildId = interaction.options.getString('guild_id', true);
      await api.postBotAdminSyncMembers(guildId, interaction.user.id);
      await interaction.editReply({
        embeds: [embedSentraAdminSyncQueued(guildId)],
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    await interaction.editReply({ embeds: [embedSentraAdminError(msg.slice(0, 1800))] });
  }
}
