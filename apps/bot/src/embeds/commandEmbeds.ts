import { EmbedBuilder } from 'discord.js';
import {
  SENTRA_DANGER,
  SENTRA_PRIMARY,
  SENTRA_SUCCESS,
  SENTRA_WARNING,
  baseEmbed,
  productFooter,
  sentraFooter,
} from './sentra';

/** Detect API 403 for unlicensed community report. */
export function isReportLicenseForbiddenError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /\b403\b/.test(msg) &&
    /no active Sentra license|Sentra license/i.test(msg)
  );
}

export function embedReportLicenseDenied(dashboardUrl: string | undefined): EmbedBuilder {
  const link = dashboardUrl?.trim()
    ? `\n\n[**Open dashboard**](${dashboardUrl})`
    : '';
  return new EmbedBuilder()
    .setColor(SENTRA_WARNING)
    .setTitle('Server license required')
    .setDescription(
      `This server does not have an active **Sentra license**, so community reports cannot be submitted yet.${link}`,
    )
    .addFields({
      name: 'Next step',
      value:
        'Ask a **platform admin** to activate a trial or subscription for this server (`/sentra-admin` or dashboard).',
    })
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedReportSuccessPending(): EmbedBuilder {
  return baseEmbed(SENTRA_SUCCESS)
    .setTitle('Report received')
    .setDescription(
      'Your report is **pending staff review**. You will not see score changes until it is approved. Thank you.',
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedReportSuccessInstant(targetId: string): EmbedBuilder {
  return baseEmbed(SENTRA_SUCCESS)
    .setTitle('Report submitted')
    .setDescription(`Thank you. Report recorded for <@${targetId}>.`)
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedReportFailed(message: string): EmbedBuilder {
  return baseEmbed(SENTRA_DANGER)
    .setTitle('Report failed')
    .setDescription(message.slice(0, 3500))
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedFlagSuccess(input: {
  flagLevel: string;
  flagScore: number;
  weightApplied: number | string;
}): EmbedBuilder {
  return baseEmbed(SENTRA_SUCCESS)
    .setTitle('Flag applied')
    .addFields(
      { name: 'Level', value: input.flagLevel, inline: true },
      { name: 'Score', value: String(input.flagScore), inline: true },
      { name: 'Weight', value: `+${input.weightApplied}`, inline: true },
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedFlagFailed(message: string): EmbedBuilder {
  return baseEmbed(SENTRA_DANGER)
    .setTitle('Flag failed')
    .setDescription(message.slice(0, 3500))
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedConfigView(fields: {
  alertChannel: string;
  minLevel: string;
  mentionRoles: string;
  updatedNote: string;
}): EmbedBuilder {
  return baseEmbed(SENTRA_PRIMARY)
    .setTitle('Alert settings')
    .addFields(
      { name: 'Alert channel', value: fields.alertChannel, inline: true },
      { name: 'Minimum level', value: fields.minLevel, inline: true },
      { name: 'Mention roles', value: fields.mentionRoles, inline: false },
      { name: '\u200b', value: fields.updatedNote, inline: false },
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedConfigSaved(): EmbedBuilder {
  return baseEmbed(SENTRA_SUCCESS)
    .setTitle('Settings saved')
    .setDescription('Alerts will use the new channel and/or minimum level.')
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedConfigFailed(message: string): EmbedBuilder {
  return baseEmbed(SENTRA_DANGER)
    .setTitle('Could not save settings')
    .setDescription(message.slice(0, 3500))
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedConfigLoadFailed(message: string): EmbedBuilder {
  return baseEmbed(SENTRA_DANGER)
    .setTitle('Could not load settings')
    .setDescription(message.slice(0, 3500))
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedHelp(dashboardUrl: string): EmbedBuilder {
  return baseEmbed(SENTRA_PRIMARY)
    .setTitle('Sentra commands')
    .setDescription('Reputation checks, community reports, and server alerts.')
    .addFields(
      {
        name: 'Commands',
        value: [
          '`/check` — Look up a user',
          '`/report` — Submit a community report',
          '`/flag` — Trusted flag (requires trusted role in Sentra)',
          '`/config` — Alert channel & level — **Manage Server**',
          '`/sentra monitor` — Operator: live log instructions',
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Dashboard',
        value: dashboardUrl,
        inline: false,
      },
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedSentraAdminLicenseOk(guildId: string, status: string): EmbedBuilder {
  return baseEmbed(SENTRA_SUCCESS)
    .setTitle('License updated')
    .setDescription(`Guild \`${guildId}\` is now **${status}**.`)
    .setFooter(sentraFooter())
    .setTimestamp(new Date());
}

export function embedSentraAdminSyncQueued(guildId: string): EmbedBuilder {
  return baseEmbed(SENTRA_PRIMARY)
    .setTitle('Member sync queued')
    .setDescription(`Guild \`${guildId}\` — check the dashboard for progress.`)
    .setFooter(sentraFooter())
    .setTimestamp(new Date());
}

export function embedSentraAdminError(message: string): EmbedBuilder {
  return baseEmbed(SENTRA_DANGER)
    .setTitle('Admin action failed')
    .setDescription(message.slice(0, 3500))
    .setFooter(sentraFooter())
    .setTimestamp(new Date());
}

export function embedMonitorHelp(input: {
  dashboardHint: string;
  opsKeyHint: string;
}): EmbedBuilder {
  return baseEmbed(SENTRA_PRIMARY)
    .setTitle('Live monitor (operators)')
    .setDescription(
      'Stream domain events from Redis on your application server — same events as the admin feed.',
    )
    .addFields(
      {
        name: 'On the VPS',
        value:
          '`./scripts/run-sentra-tail.sh --stats-interval=30` (loads `.env`; set `SENTRA_OPS_STATS_KEY` for stats footer)',
      },
      {
        name: 'Or manually',
        value:
          '`node apps/ops-cli/dist/index.js monitor` — alias for the tail binary; use `--enrich` with `DISCORD_BOT_TOKEN` for names.',
      },
      { name: 'Dashboard', value: input.dashboardHint, inline: false },
      { name: 'Stats API key', value: input.opsKeyHint, inline: false },
    )
    .setFooter(sentraFooter())
    .setTimestamp(new Date());
}

export function embedNeedGuild(): EmbedBuilder {
  return baseEmbed(SENTRA_WARNING)
    .setTitle('Wrong place')
    .setDescription('Use this command in a server.')
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedNeedManageServer(): EmbedBuilder {
  return baseEmbed(SENTRA_WARNING)
    .setTitle('Permission required')
    .setDescription('You need **Manage Server** or **Administrator**.')
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedConfigNeedOptions(): EmbedBuilder {
  return baseEmbed(SENTRA_WARNING)
    .setTitle('Nothing to update')
    .setDescription('Provide at least one of **channel** or **minlevel**.')
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedConfigBadChannel(): EmbedBuilder {
  return baseEmbed(SENTRA_WARNING)
    .setTitle('Invalid channel')
    .setDescription('Pick a text, announcement, or forum channel.')
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedCheckFailed(message: string): EmbedBuilder {
  return baseEmbed(SENTRA_DANGER)
    .setTitle('Lookup failed')
    .setDescription(message.slice(0, 3500))
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedPlatformAdminOnly(): EmbedBuilder {
  return baseEmbed(SENTRA_WARNING)
    .setTitle('Access denied')
    .setDescription('You are not a **Sentra platform admin** for this environment.')
    .setFooter(sentraFooter())
    .setTimestamp(new Date());
}

export function embedOperatorsOnly(): EmbedBuilder {
  return baseEmbed(SENTRA_WARNING)
    .setTitle('Operators only')
    .setDescription('This command is for Sentra platform operators only.')
    .setFooter(sentraFooter())
    .setTimestamp(new Date());
}

export function embedRateLimited(): EmbedBuilder {
  return baseEmbed(SENTRA_WARNING)
    .setTitle('Slow down')
    .setDescription('This server is sending commands too quickly. Try again in a moment.')
    .setFooter(productFooter())
    .setTimestamp(new Date());
}
