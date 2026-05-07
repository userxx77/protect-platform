import { EmbedBuilder } from 'discord.js';
import {
  SENTRA_DANGER,
  SENTRA_PRIMARY,
  SENTRA_SUCCESS,
  SENTRA_WARNING,
  baseCommandEmbed,
  baseFeedEmbed,
} from './sentra';

/** Detect API 403 for unlicensed community report. */
export function isReportCommunityRoleForbiddenError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /\b403\b/.test(msg) &&
    /Community reports require a dashboard account with the User role/i.test(msg)
  );
}

export function embedReportCommunityRoleDenied(dashboardUrl: string | undefined): EmbedBuilder {
  const link = dashboardUrl?.trim() ? ` [Dashboard](${dashboardUrl})` : '';
  return baseCommandEmbed(SENTRA_WARNING)
    .setTitle('Role required')
    .setDescription(`Community reports need the **User** role in Sentra.${link}`)
    .addFields({
      name: 'What to do',
      value: 'Ask a platform admin to grant **User** on your Discord account.',
    });
}

/** Detect API 403 for unlicensed community report. */
export function isReportLicenseForbiddenError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /\b403\b/.test(msg) &&
    /no active Sentra license|Sentra license/i.test(msg)
  );
}

export function embedReportLicenseDenied(dashboardUrl: string | undefined): EmbedBuilder {
  const link = dashboardUrl?.trim() ? ` [Dashboard](${dashboardUrl})` : '';
  return baseCommandEmbed(SENTRA_WARNING)
    .setTitle('No license')
    .setDescription(`This server has no active Sentra license.${link}`)
    .addFields({
      name: 'What to do',
      value: 'Platform admin: trial or subscription (`/sentra platform license` or billing).',
    });
}

export function embedReportSuccessPending(reportedSeverityLabel?: string): EmbedBuilder {
  const b = baseCommandEmbed(SENTRA_SUCCESS)
    .setTitle('Queued')
    .setDescription('Staff must approve in the dashboard before reputation changes.');
  if (reportedSeverityLabel?.trim()) {
    b.addFields({ name: 'Tier', value: reportedSeverityLabel, inline: true });
  }
  return b;
}

export function embedReportSuccessInstant(targetId: string, reportedSeverityLabel?: string): EmbedBuilder {
  const b = baseCommandEmbed(SENTRA_SUCCESS)
    .setTitle('Recorded')
    .setDescription(`Report for <@${targetId}> saved.`);
  if (reportedSeverityLabel?.trim()) {
    b.addFields({ name: 'Tier', value: reportedSeverityLabel, inline: true });
  }
  return b;
}

export function embedReportFailed(message: string): EmbedBuilder {
  return baseCommandEmbed(SENTRA_DANGER)
    .setTitle('Report failed')
    .setDescription(message.slice(0, 3500));
}

export function embedFlagSuccess(input: {
  flagLevel: string;
  flagScore: number;
  weightApplied: number | string;
  severityLabel?: string;
}): EmbedBuilder {
  const sev = input.severityLabel?.trim();
  const lines = [
    sev ? `Tier: **${sev}**` : null,
    `Level: **${input.flagLevel}** · Score: **${String(input.flagScore)}** · Weight: **+${input.weightApplied}**`,
  ]
    .filter(Boolean)
    .join('\n');
  return baseCommandEmbed(SENTRA_SUCCESS).setTitle('Flag applied').setDescription(lines);
}

export function embedFlagFailed(message: string): EmbedBuilder {
  return baseCommandEmbed(SENTRA_DANGER)
    .setTitle('Flag failed')
    .setDescription(message.slice(0, 3500));
}

export function embedConfigView(fields: {
  alertChannel: string;
  minLevel: string;
  mentionRoles: string;
  joinHoldEnabled: string;
  joinHoldMinutes: string;
  joinHoldMinLevel: string;
  joinActionPolicy: string;
  updatedNote: string;
}): EmbedBuilder {
  const b = baseCommandEmbed(SENTRA_PRIMARY)
    .setTitle('Settings')
    .addFields(
      {
        name: 'Alerts',
        value: `Channel: ${fields.alertChannel}\nMin level: ${fields.minLevel}\nJoin action: ${fields.joinActionPolicy}`,
        inline: true,
      },
      {
        name: 'Join hold',
        value: `Enabled: ${fields.joinHoldEnabled}\nMinutes: ${fields.joinHoldMinutes}\nMin level: ${fields.joinHoldMinLevel}`,
        inline: true,
      },
      { name: 'Mention roles', value: fields.mentionRoles, inline: false },
    );
  if (fields.updatedNote?.trim()) {
    b.addFields({ name: 'Note', value: fields.updatedNote, inline: false });
  }
  return b;
}

export function embedConfigSaved(): EmbedBuilder {
  return baseCommandEmbed(SENTRA_SUCCESS)
    .setTitle('Saved')
    .setDescription('Your changes are live.');
}

export function embedConfigFailed(message: string): EmbedBuilder {
  return baseCommandEmbed(SENTRA_DANGER)
    .setTitle('Save failed')
    .setDescription(message.slice(0, 3500));
}

export function embedConfigLoadFailed(message: string): EmbedBuilder {
  return baseCommandEmbed(SENTRA_DANGER)
    .setTitle('Load failed')
    .setDescription(message.slice(0, 3500));
}

export function embedHelp(dashboardUrl: string): EmbedBuilder {
  return baseCommandEmbed(SENTRA_PRIMARY)
    .setTitle('Commands')
    .setDescription(
      [
        '**Everyone:** `check`, `report`, `flag` (trusted), `config` (Manage Server), `help`, `support`, `setup` (short checklist).',
        '**Platform admin:** `platform` (license, sync), `approve` / `reject` (needs **`level`** on approve), `reports_pending`, `unflag`, `report_status`.',
        `**New reports** also post to the ops channel when \`DISCORD_ADMIN_FEED_CHANNEL_ID\` is set on the bot.`,
        `Dashboard: ${dashboardUrl}`,
      ].join('\n'),
    );
}

export function embedSetupStart(guildName: string): EmbedBuilder {
  return baseCommandEmbed(SENTRA_PRIMARY)
    .setTitle('Start here')
    .setDescription(`**${guildName}**`)
    .addFields(
      {
        name: '1',
        value: 'Active Sentra license (admin: `/sentra platform license`).',
        inline: false,
      },
      {
        name: '2',
        value: 'Staff channel + min level: `/sentra config show` and `/sentra config set`.',
        inline: false,
      },
      {
        name: '3',
        value: 'Bot permissions: Administrator or the role permissions in the Sentra docs.',
        inline: false,
      },
    );
}

export function embedSetupAlerts(): EmbedBuilder {
  return baseCommandEmbed(SENTRA_PRIMARY)
    .setTitle('Alerts')
    .setDescription(
      [
        '`/sentra config show` — see current channel',
        '`/sentra config set` — pick text / announcement / forum channel',
        'Set **minlevel** so CLEAN users do not spam pings',
        'Optional join hold: **joinhold_*** in `/sentra config set`; bot needs **Moderate / Kick / Ban Members**',
      ].join('\n'),
    );
}

export function embedSetupReports(): EmbedBuilder {
  return baseCommandEmbed(SENTRA_PRIMARY)
    .setTitle('Reports')
    .setDescription(
      [
        'Needs **User** role in Sentra. Queued reports need staff approval in the dashboard.',
        'Use a clear reason; quality beats volume.',
      ].join('\n'),
    );
}

export function embedSetupPermissions(): EmbedBuilder {
  return baseCommandEmbed(SENTRA_PRIMARY)
    .setTitle('Permissions')
    .setDescription(
      [
        'Send messages & embed links · read history · view channels',
        'Join hold: Moderate + Kick + Ban — bot role **above** targets',
        '`/sentra config` needs **Manage Server** on you, not on the bot',
      ].join('\n'),
    );
}

export function embedSentraAdminLicenseOk(guildId: string, status: string): EmbedBuilder {
  return baseFeedEmbed(SENTRA_SUCCESS)
    .setTitle('License updated')
    .setDescription(`\`${guildId}\` → **${status}**`);
}

export function embedSentraAdminSyncQueued(guildId: string): EmbedBuilder {
  return baseFeedEmbed(SENTRA_PRIMARY)
    .setTitle('Sync queued')
    .setDescription(`\`${guildId}\` — progress in dashboard.`);
}

export function embedSentraAdminError(message: string): EmbedBuilder {
  return baseFeedEmbed(SENTRA_DANGER)
    .setTitle('Admin failed')
    .setDescription(message.slice(0, 3500));
}

export function embedSentraSupport(input: {
  ticketsUrl: string;
  dashboardUrl: string;
}): EmbedBuilder {
  return baseCommandEmbed(SENTRA_PRIMARY)
    .setTitle('Support')
    .setDescription(
      [
        'We handle escalations in the dashboard — not via Discord DMs to the bot.',
        `[**Tickets / help**](${input.ticketsUrl})`,
        input.dashboardUrl ? `[**Dashboard**](${input.dashboardUrl})` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
}

export function embedMonitorHelp(input: {
  dashboardHint: string;
  opsKeyHint: string;
}): EmbedBuilder {
  return baseFeedEmbed(SENTRA_PRIMARY)
    .setTitle('Live tail')
    .setDescription(
      [
        'VPS: `./scripts/run-sentra-tail.sh` (optional `SENTRA_OPS_STATS_KEY`)',
        'Manual: `node apps/ops-cli/dist/index.js monitor`',
        `Dashboard: ${input.dashboardHint}`,
        input.opsKeyHint,
      ].join('\n'),
    );
}

export function embedNeedGuild(): EmbedBuilder {
  return baseCommandEmbed(SENTRA_WARNING)
    .setTitle('Server only')
    .setDescription('Run this in a server.');
}

export function embedNeedManageServer(): EmbedBuilder {
  return baseCommandEmbed(SENTRA_WARNING)
    .setTitle('Permission')
    .setDescription('You need **Manage Server** or **Administrator**.');
}

export function embedConfigNeedOptions(): EmbedBuilder {
  return baseCommandEmbed(SENTRA_WARNING)
    .setTitle('Nothing to change')
    .setDescription('Set **channel**, **minlevel**, and/or join hold fields.');
}

export function embedConfigBadChannel(): EmbedBuilder {
  return baseCommandEmbed(SENTRA_WARNING)
    .setTitle('Bad channel')
    .setDescription('Use text, announcement, or forum.');
}

export function embedCheckFailed(message: string): EmbedBuilder {
  return baseCommandEmbed(SENTRA_DANGER)
    .setTitle('Lookup failed')
    .setDescription(message.slice(0, 3500));
}

export function embedPlatformAdminOnly(): EmbedBuilder {
  return baseFeedEmbed(SENTRA_WARNING)
    .setTitle('Denied')
    .setDescription('Platform admin only.');
}

export function embedOperatorsOnly(): EmbedBuilder {
  return baseFeedEmbed(SENTRA_WARNING)
    .setTitle('Operators only')
    .setDescription('Platform operators only.');
}

export function embedRateLimited(): EmbedBuilder {
  return baseCommandEmbed(SENTRA_WARNING)
    .setTitle('Rate limit')
    .setDescription('Slow down; try again shortly.');
}
