import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js';
import { discordSlashLevelChoices, isDiscordPlatformAdmin } from '@protect/shared';
import type { Env } from '../config/env';
import type { ApiClient } from '../services/apiClient';
import { SENTRA_DANGER, SENTRA_WARNING, SENTRA_PRIMARY, baseCommandEmbed } from '../embeds/sentra';
import {
  embedMonitorHelp,
  embedOperatorsOnly,
  embedPlatformAdminOnly,
  embedSentraSupport,
} from '../embeds/commandEmbeds';
import { executeCheck } from './check';
import { executeReport } from './report';
import { executeFlag } from './flag';
import {
  executeConfigSet,
  executeConfigView,
  withConfigSetOptions,
} from './config';
import { executeSetup } from './setup';
import { executeHelp } from './help';
import { executeSentraAdmin } from './sentra-admin';

function ticketsPath(env: Env): string {
  const base = env.WEB_URL?.replace(/\/$/, '') ?? '';
  return base ? `${base}/dashboard/tickets` : '/dashboard/tickets';
}

export const sentraCommandData = new SlashCommandBuilder()
  .setName('sentra')
  .setDescription('Sentra — all bot commands (check, report, config, setup, support, …)')
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('help')
      .setDescription('Command list, setup hints, and dashboard link'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('monitor')
      .setDescription('Stream the live Redis event log from your application server'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('support')
      .setDescription('Help & tickets (dashboard); optional DM with the same links')
      .addBooleanOption((o) =>
        o
          .setName('dm')
          .setDescription('Also send these links to your DMs')
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('check')
      .setDescription('Look up Sentra reputation for a member (same as /check)')
      .addUserOption((o) =>
        o.setName('user').setDescription('Member to look up').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('report')
      .setDescription('Submit a community report (same as /report)')
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
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('flag')
      .setDescription('Trusted reporters: apply a weighted flag (same as /flag)')
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
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('config')
      .setDescription('Server configuration (Manage Server)')
      .addSubcommand((sub) =>
        sub
          .setName('show')
          .setDescription('Show saved alert and join hold settings'),
      )
      .addSubcommand((sub) =>
        withConfigSetOptions(
          sub
            .setName('set')
            .setDescription('Update alert channel, levels, or join hold options'),
        ),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('setup')
      .setDescription('Guided server setup: alerts, reports, permissions')
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
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('platform')
      .setDescription('[Platform admin] Licenses and member sync')
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
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('approve')
      .setDescription('[Platform admin] Approve a pending report by id')
      .addStringOption((o) =>
        o.setName('report_id').setDescription('Report UUID').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reject')
      .setDescription('[Platform admin] Reject a pending report by id')
      .addStringOption((o) =>
        o.setName('report_id').setDescription('Report UUID').setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('note')
          .setDescription('Optional moderator note')
          .setRequired(false)
          .setMaxLength(500),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('report_status')
      .setDescription('Show status for a report you filed or [admin] any report')
      .addStringOption((o) =>
        o.setName('report_id').setDescription('Report UUID').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reports_mine')
      .setDescription('List your recent reports in this product'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reports_pending')
      .setDescription('[Platform admin] List pending community reports'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('unflag')
      .setDescription('[Platform admin] Delete a flag on a user by flag id')
      .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
      .addStringOption((o) =>
        o.setName('flag_id').setDescription('Flag UUID').setRequired(true),
      ),
  );

export async function executeSentra(
  interaction: ChatInputCommandInteraction,
  api: ApiClient,
  client: Client,
  env: Env,
): Promise<void> {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(true);

  if (group === 'config' && sub === 'show') {
    await executeConfigView(interaction, api);
    return;
  }
  if (group === 'config' && sub === 'set') {
    await executeConfigSet(interaction, api);
    return;
  }
  if (group === 'setup') {
    await executeSetup(interaction);
    return;
  }
  if (group === 'platform') {
    await executeSentraAdmin(interaction, api, env);
    return;
  }

  switch (sub) {
    case 'help':
      await executeHelp(interaction, env);
      return;
    case 'monitor': {
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
      return;
    }
    case 'support': {
      const dash = env.WEB_URL?.replace(/\/$/, '') ?? '';
      const ticketsUrl = ticketsPath(env);
      const embed = embedSentraSupport({ ticketsUrl, dashboardUrl: dash || '—' });
      const wantDm = interaction.options.getBoolean('dm') === true;
      await interaction.reply({ ephemeral: true, embeds: [embed] });
      if (wantDm) {
        try {
          await interaction.user.send({ embeds: [embed] });
        } catch {
          await interaction.followUp({
            ephemeral: true,
            embeds: [
              baseCommandEmbed(SENTRA_WARNING)
                .setTitle('DM blocked')
                .setDescription('Enable DMs from server members or open the links from the message above.'),
            ],
          });
        }
      }
      return;
    }
    case 'check':
      await executeCheck(interaction, api, client, env.WEB_URL);
      return;
    case 'report':
      await executeReport(interaction, api, env);
      return;
    case 'flag':
      await executeFlag(interaction, api);
      return;
    case 'approve':
    case 'reject':
    case 'report_status':
    case 'reports_mine':
    case 'reports_pending':
    case 'unflag':
      await executeSentraPlatform(api, interaction, env, sub);
      return;
    default:
      await interaction.reply({
        ephemeral: true,
        embeds: [
          baseCommandEmbed(SENTRA_DANGER)
            .setTitle('Unknown')
            .setDescription('Pick a `/sentra` subcommand (try `/sentra support`).'),
        ],
      });
  }
}

async function executeSentraPlatform(
  api: ApiClient,
  interaction: ChatInputCommandInteraction,
  env: Env,
  sub: string,
): Promise<void> {
  const isAdmin = isDiscordPlatformAdmin(interaction.user.id, env.ADMIN_DISCORD_IDS);

  await interaction.deferReply({ ephemeral: true });

  try {
    if (sub === 'reports_mine') {
      const rows = await api.botReportsMine(interaction.user.id, 15);
      const lines = rows.items.length
        ? rows.items
            .map(
              (r) =>
                `• **${r.status}** · <@${r.targetDiscordId}> · \`${r.id.slice(0, 8)}…\`\n_${r.reason.slice(0, 120)}${r.reason.length > 120 ? '…' : ''}_`,
            )
            .join('\n')
        : '_No reports found._';
      await interaction.editReply({
        embeds: [
          baseCommandEmbed(SENTRA_PRIMARY)
            .setTitle('Your reports')
            .setDescription(lines.slice(0, 3900)),
        ],
      });
      return;
    }

    if (sub === 'report_status') {
      const id = interaction.options.getString('report_id', true);
      const r = await api.botReportGet(id, interaction.user.id);
      await interaction.editReply({
        embeds: [
          baseCommandEmbed(SENTRA_PRIMARY)
            .setTitle('Report')
            .setDescription(
              [
                `**Status:** ${r.status}`,
                `**Target:** <@${r.targetDiscordId}>`,
                r.guildId ? `**Guild:** \`${r.guildId}\`` : null,
                `**Reporter:** <@${r.reporterDiscordId}>`,
                r.allegedFlagLevel ? `**Alleged tier:** ${r.allegedFlagLevel}` : null,
                `**Reason:** ${r.reason.slice(0, 500)}${r.reason.length > 500 ? '…' : ''}`,
                r.reviewedAt ? `**Reviewed:** ${r.reviewedAt}` : null,
                r.resolverNote ? `**Note:** ${r.resolverNote}` : null,
              ]
                .filter(Boolean)
                .join('\n'),
            ),
        ],
      });
      return;
    }

    if (!isAdmin) {
      await interaction.editReply({
        embeds: [embedPlatformAdminOnly()],
      });
      return;
    }

    if (sub === 'reports_pending') {
      const { items } = await api.botReportsPending(interaction.user.id);
      const lines = items.length
        ? items
            .map(
              (r) =>
                `• \`${r.id}\` · <@${r.targetDiscordId}> · **${r.status}**\n${r.reason.slice(0, 160)}${r.reason.length > 160 ? '…' : ''}`,
            )
            .join('\n\n')
        : '_No pending reports._';
      await interaction.editReply({
        embeds: [
          baseCommandEmbed(SENTRA_PRIMARY)
            .setTitle('Pending reports')
            .setDescription(lines.slice(0, 3900)),
        ],
      });
      return;
    }

    if (sub === 'approve') {
      const id = interaction.options.getString('report_id', true);
      const out = await api.botReportApprove(id, interaction.user.id);
      await interaction.editReply({
        embeds: [
          baseCommandEmbed(SENTRA_PRIMARY)
            .setTitle('Approved')
            .setDescription(
              `Report **${out.id}** → **${out.status}** · target level **${out.targetFlagLevel}** · weight **+${out.appliedFlagWeight}**`,
            ),
        ],
      });
      return;
    }

    if (sub === 'reject') {
      const id = interaction.options.getString('report_id', true);
      const note = interaction.options.getString('note') ?? undefined;
      const out = await api.botReportReject(id, interaction.user.id, note);
      await interaction.editReply({
        embeds: [
          baseCommandEmbed(SENTRA_PRIMARY)
            .setTitle('Rejected')
            .setDescription(`Report **${out.id}** → **${out.status}**`),
        ],
      });
      return;
    }

    if (sub === 'unflag') {
      const user = interaction.options.getUser('user', true);
      const flagId = interaction.options.getString('flag_id', true);
      await api.botAdminUnflag(user.id, flagId, interaction.user.id);
      await interaction.editReply({
        embeds: [
          baseCommandEmbed(SENTRA_PRIMARY)
            .setTitle('Flag removed')
            .setDescription(`Removed flag **${flagId}** on <@${user.id}>.`),
        ],
      });
      return;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await interaction.editReply({
      embeds: [
        baseCommandEmbed(SENTRA_DANGER).setTitle('Command failed').setDescription(msg.slice(0, 3500)),
      ],
    });
  }
}
