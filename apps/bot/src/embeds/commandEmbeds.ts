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
export function isReportCommunityRoleForbiddenError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /\b403\b/.test(msg) &&
    /Community reports require a dashboard account with the User role/i.test(msg)
  );
}

export function embedReportCommunityRoleDenied(dashboardUrl: string | undefined): EmbedBuilder {
  const link = dashboardUrl?.trim()
    ? `\n\n[**Open dashboard**](${dashboardUrl})`
    : '';
  return new EmbedBuilder()
    .setColor(SENTRA_WARNING)
    .setTitle('Account role required')
    .setDescription(
      `**Community reports** (pending staff review) are limited to accounts with **User** access in Sentra. Checker accounts can still use \`/check\` and trusted reporters can use \`/flag\` where applicable.${link}`,
    )
    .addFields({
      name: 'Next step',
      value:
        'Ask a **platform admin** to grant **User** role for your Discord account in Sentra.',
    })
    .setFooter(productFooter())
    .setTimestamp(new Date());
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

export function embedReportSuccessPending(reportedSeverityLabel?: string): EmbedBuilder {
  const b = baseEmbed(SENTRA_SUCCESS)
    .setTitle('Report queued for review')
    .setDescription(
      'Thanks — your report is in the **moderation queue**. Reputation only updates after staff **approve** it in the Sentra dashboard. You will not see a score change until then.',
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
  if (reportedSeverityLabel?.trim()) {
    b.addFields({
      name: 'Your severity',
      value: reportedSeverityLabel,
      inline: true,
    });
  }
  return b;
}

export function embedReportSuccessInstant(targetId: string, reportedSeverityLabel?: string): EmbedBuilder {
  const b = baseEmbed(SENTRA_SUCCESS)
    .setTitle('Report recorded')
    .setDescription(
      `Your report for <@${targetId}> was recorded. No further action is needed from you.`,
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
  if (reportedSeverityLabel?.trim()) {
    b.addFields({
      name: 'Your severity',
      value: reportedSeverityLabel,
      inline: true,
    });
  }
  return b;
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
  /** Display label for the tier chosen on /flag */
  severityLabel?: string;
}): EmbedBuilder {
  const fields = [
    { name: 'Aggregate level', value: input.flagLevel, inline: true },
    { name: 'Score', value: String(input.flagScore), inline: true },
    { name: 'Weight', value: `+${input.weightApplied}`, inline: true },
  ] as const;
  const b = baseEmbed(SENTRA_SUCCESS).setTitle('Flag applied').setFooter(productFooter()).setTimestamp(new Date());
  if (input.severityLabel?.trim()) {
    b.addFields(
      { name: 'Flag tier', value: input.severityLabel, inline: true },
      ...fields,
    );
  } else {
    b.addFields(...fields);
  }
  return b;
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
  joinHoldEnabled: string;
  joinHoldMinutes: string;
  joinHoldMinLevel: string;
  updatedNote: string;
}): EmbedBuilder {
  return baseEmbed(SENTRA_PRIMARY)
    .setTitle('Alert & join hold settings')
    .addFields(
      { name: 'Alert channel', value: fields.alertChannel, inline: true },
      { name: 'Alert min level', value: fields.minLevel, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      {
        name: 'Join hold',
        value: fields.joinHoldEnabled,
        inline: true,
      },
      {
        name: 'Hold duration (min)',
        value: fields.joinHoldMinutes,
        inline: true,
      },
      {
        name: 'Hold min level',
        value: fields.joinHoldMinLevel,
        inline: true,
      },
      { name: 'Mention roles', value: fields.mentionRoles, inline: false },
      { name: '\u200b', value: fields.updatedNote, inline: false },
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedConfigSaved(): EmbedBuilder {
  return baseEmbed(SENTRA_SUCCESS)
    .setTitle('Settings saved')
    .setDescription(
      'Alert channel, levels, and join hold options are updated where you changed them.',
    )
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
    .setTitle('Sentra · Command reference')
    .setDescription('Reputation checks, community reports, trust flags, and staff alerts.')
    .addFields(
      {
        name: 'Member commands',
        value: [
          '`/check` — Look up Sentra reputation for a user',
          '`/report` — Submit a community report (pending staff review)',
          '`/flag` — Trusted reporters: weighted flag (API-enforced role)',
          '`/help` — This overview',
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Server setup',
        value: [
          '`/setup` — Guided setup (alerts, reports, permissions)',
          '`/config` — Alerts, optional **join hold** (timeout + moderation buttons) — **Manage Server**',
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Operators',
        value:
          '`/sentra monitor` — Live event tail instructions (platform admins only)',
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

export function embedSetupStart(guildName: string): EmbedBuilder {
  return baseEmbed(SENTRA_PRIMARY)
    .setTitle('Getting started with Sentra')
    .setDescription(
      `Here is the fastest path to a clean rollout on **${guildName}**.`,
    )
    .addFields(
      {
        name: '1 · License',
        value:
          'Your server needs an **active Sentra license**. Platform admins can use `/sentra-admin` or the billing dashboard.',
      },
      {
        name: '2 · Alerts',
        value:
          'Pick a staff channel and minimum risk level with `/config set`, or open `/setup alerts` for a step-by-step.',
      },
      {
        name: '3 · Permissions',
        value: 'Run `/setup permissions` so moderation roles match what Sentra expects.',
      },
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedSetupAlerts(): EmbedBuilder {
  return baseEmbed(SENTRA_PRIMARY)
    .setTitle('Alert channel setup')
    .setDescription(
      'High-signal join and manual **check** alerts post to one channel. **Join hold** can time risky members out and post Kick/Ban/Release buttons in the same channel.',
    )
    .addFields(
      {
        name: 'Step 1',
        value:
          'Run `/config view` — confirm whether an alert channel is already saved.',
      },
      {
        name: 'Step 2',
        value:
          'Run `/config set` and pick a **text**, **announcement**, or **forum** channel staff can monitor.',
      },
      {
        name: 'Step 3',
        value:
          'Set **minlevel** to `SUSPICIOUS`, `HIGH_RISK`, or stricter so CLEAN members do not ping the room.',
      },
      {
        name: 'Step 4 · Join hold (optional)',
        value:
          'In `/config set`, set **joinhold_enabled** and tune **joinhold_minlevel** / **joinhold_minutes**. Give the bot **Moderate Members**, **Kick Members**, and **Ban Members** so timeouts and buttons work.',
        inline: false,
      },
      {
        name: 'Mentions',
        value:
          'Role mentions (if configured in the dashboard) follow the same rules — tune minlevel to avoid alert fatigue.',
        inline: false,
      },
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedSetupReports(): EmbedBuilder {
  return baseEmbed(SENTRA_PRIMARY)
    .setTitle('Community reports')
    .setDescription(
      '`/report` sends structured reports to your Sentra operators. Abuse is logged; quality reports help everyone.',
    )
    .addFields(
      {
        name: 'Who can report',
        value:
          'Discord accounts with **User** access in Sentra can submit community reports. Checker-only accounts should use `/check` or trusted `/flag` where applicable.',
      },
      {
        name: 'What happens next',
        value:
          'Most reports are **queued**. Staff **approve or reject** in the dashboard before reputation changes apply.',
      },
      {
        name: 'Tips',
        value:
          'Use a clear, factual **reason** and avoid ping storms — one solid report beats volume.',
      },
    )
    .setFooter(productFooter())
    .setTimestamp(new Date());
}

export function embedSetupPermissions(): EmbedBuilder {
  return baseEmbed(SENTRA_PRIMARY)
    .setTitle('Bot permissions checklist')
    .setDescription(
      'Sentra needs a small, predictable permission set. Grant only what your security model allows.',
    )
    .addFields(
      {
        name: 'Recommended',
        value: [
          '**View channels** — Read channel metadata for alerts',
          '**Send messages** & **embed links** — Post alert embeds',
          '**Read message history** — Consistent delivery in busy channels',
        ].join('\n'),
      },
      {
        name: 'Members',
        value:
          '**Guild members intent** is enabled so joins sync to Sentra. Invite the bot with **applications.commands** scope.',
      },
      {
        name: 'Join hold actions',
        value:
          '**Moderate Members** (timeouts), **Kick Members**, and **Ban Members** — the bot role must sit **above** members it moderates.',
        inline: false,
      },
      {
        name: 'Staff commands',
        value:
          '`/config` requires **Manage Server** or **Administrator** on the invoker, not the bot.',
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
    .setDescription(
      'Set at least one option: **channel**, **minlevel**, or a **join hold** field.',
    )
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
