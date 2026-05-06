import { EmbedBuilder, type ColorResolvable } from 'discord.js';

/** Brand accent — aligns with dashboard purple */
export const BRAND_PRIMARY = 0x8b5cf6;
export const BRAND_MUTED = 0x6d28d9;
export const SENTRA_PRIMARY = BRAND_PRIMARY;
export const SENTRA_SUCCESS = 0x34d399;
export const SENTRA_WARNING = 0xfbbf24;
export const SENTRA_DANGER = 0xf87171;
export const SENTRA_INFO = 0x38bdf8;

const FOOTER_OPS = 'Sentra · admin feed';
const FOOTER_PRODUCT = 'Sentra · anti-cheat intelligence';

export function sentraFooter(): { text: string } {
  return { text: FOOTER_OPS };
}

/** Footer for slash command replies (end users). */
export function productFooter(): { text: string } {
  return { text: FOOTER_PRODUCT };
}

/** Discord CDN guild icon (png); pass guild id and icon hash from API/bot. */
export function guildIconUrl(
  guildId: string,
  iconHash: string | null | undefined,
): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}`;
}

/** Base for operator / system feed embeds (Redis → admin channel). */
export function baseEmbed(color: ColorResolvable = SENTRA_PRIMARY): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter(sentraFooter())
    .setTimestamp(new Date());
}

export function embedGuildDiscovered(input: {
  guildId: string;
  name: string | null;
  approximateMemberCount: number | null;
  iconHash?: string | null;
}): EmbedBuilder {
  const e = baseEmbed(SENTRA_SUCCESS)
    .setTitle('Server connected')
    .setDescription(
      `**${input.name ?? 'Unknown server'}** added Sentra. Run \`/setup alerts\` to configure staff notifications.`,
    )
    .addFields(
      { name: 'Server ID', value: `\`${input.guildId}\``, inline: true },
      {
        name: 'Members (approx.)',
        value:
          input.approximateMemberCount != null
            ? String(input.approximateMemberCount)
            : '—',
        inline: true,
      },
    );
  const icon = guildIconUrl(input.guildId, input.iconHash);
  if (icon) e.setThumbnail(icon);
  return e;
}

export function embedReportPending(input: {
  reportId?: string;
  targetDiscordId?: string;
  reporterDiscordId?: string;
  guildId?: string | null;
  reason?: string;
  guildName?: string | null;
  guildIconUrl?: string | null;
}): EmbedBuilder {
  const target = input.targetDiscordId
    ? `<@${input.targetDiscordId}>`
    : '—';
  const reporter = input.reporterDiscordId
    ? `<@${input.reporterDiscordId}>`
    : '—';

  const serverLine =
    input.guildName && input.guildId
      ? `**${input.guildName}** · \`${input.guildId}\``
      : input.guildId
        ? `\`${input.guildId}\``
        : '—';

  const reasonBlock = input.reason?.trim()
    ? input.reason.length > 900
      ? `${input.reason.slice(0, 897)}…`
      : input.reason
    : '*No summary provided.*';

  const e = new EmbedBuilder()
    .setColor(SENTRA_WARNING)
    .setTitle('Community report · awaiting review')
    .setDescription(
      'Moderators need to **approve or reject** this report in the Sentra dashboard before any reputation change applies.',
    )
    .addFields(
      {
        name: 'Report ID',
        value: `\`${input.reportId ?? '—'}\``,
        inline: true,
      },
      { name: 'Server', value: serverLine, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Reported user', value: `${target}`, inline: true },
      { name: 'Submitted by', value: reporter, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Details', value: reasonBlock, inline: false },
    )
    .setFooter(sentraFooter())
    .setTimestamp(new Date());

  if (input.guildIconUrl) {
    e.setThumbnail(input.guildIconUrl);
  }

  return e;
}

export function embedSupportTicketAdmin(input: {
  kind: string;
  ticketId?: string;
  reportId?: string;
  reporterDiscordId?: string;
  guildId?: string | null;
  status?: string;
  attachmentCount?: number;
  linkCount?: number;
}): EmbedBuilder {
  const title =
    input.kind === 'support.ticket.created'
      ? 'Support ticket opened'
      : input.kind === 'support.ticket.evidence_submitted'
        ? 'Evidence submitted'
        : input.kind === 'support.ticket.resolved' && input.status === 'REJECTED'
          ? 'Ticket rejected'
          : input.kind === 'support.ticket.resolved'
            ? 'Ticket resolved'
            : 'Ticket update';
  const color =
    input.kind === 'support.ticket.resolved' && input.status !== 'REJECTED'
      ? SENTRA_SUCCESS
      : SENTRA_WARNING;
  const e = baseEmbed(color).setTitle(title);
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Ticket', value: `\`${input.ticketId ?? '—'}\``, inline: true },
    { name: 'Linked report', value: `\`${input.reportId ?? '—'}\``, inline: true },
  ];
  if (input.reporterDiscordId) {
    fields.push({
      name: 'Reporter',
      value: `<@${input.reporterDiscordId}>`,
      inline: true,
    });
  }
  if (input.guildId) {
    fields.push({ name: 'Server ID', value: `\`${input.guildId}\``, inline: true });
  }
  if (input.status) {
    fields.push({ name: 'Status', value: input.status, inline: true });
  }
  if (input.kind === 'support.ticket.evidence_submitted') {
    fields.push({
      name: 'Evidence',
      value: `${input.attachmentCount ?? 0} attachment(s), ${input.linkCount ?? 0} link(s)`,
      inline: false,
    });
  }
  return e.addFields(fields);
}

export function embedMemberSyncStarted(input: {
  guildId: string;
  guildName: string;
  iconHash?: string | null;
}): EmbedBuilder {
  const e = baseEmbed(SENTRA_PRIMARY)
    .setTitle('Member cache sync · started')
    .setDescription(
      `Pulling members for **${input.guildName}**. This may take a moment for large servers.`,
    )
    .addFields({ name: 'Server ID', value: `\`${input.guildId}\``, inline: false });
  const icon = guildIconUrl(input.guildId, input.iconHash);
  if (icon) e.setThumbnail(icon);
  return e;
}

export function embedMemberSyncCompleted(input: {
  guildId: string;
  guildName: string;
  memberCount: number;
  iconHash?: string | null;
}): EmbedBuilder {
  const e = baseEmbed(SENTRA_SUCCESS)
    .setTitle('Member cache sync · complete')
    .setDescription(
      `**${input.guildName}** — cached **${input.memberCount.toLocaleString('en-US')}** member profiles for the dashboard.`,
    )
    .addFields({ name: 'Server ID', value: `\`${input.guildId}\``, inline: false });
  const icon = guildIconUrl(input.guildId, input.iconHash);
  if (icon) e.setThumbnail(icon);
  return e;
}

export function embedMemberSyncFailed(input: {
  guildId: string;
  guildName?: string;
  error: string;
  iconHash?: string | null;
}): EmbedBuilder {
  const e = baseEmbed(SENTRA_DANGER)
    .setTitle('Member cache sync · failed')
    .setDescription(
      `${input.guildName ? `**${input.guildName}** · ` : ''}\`${input.guildId}\``,
    )
    .addFields({
      name: 'Error',
      value: `\`\`\`${input.error.slice(0, 900)}\`\`\``,
      inline: false,
    });
  const icon = guildIconUrl(input.guildId, input.iconHash ?? undefined);
  if (icon) e.setThumbnail(icon);
  return e;
}

export function embedUnknownGuildSync(input: { guildId: string }): EmbedBuilder {
  return baseEmbed(SENTRA_WARNING)
    .setTitle('Member sync skipped')
    .setDescription(
      `The bot is not in this server or Discord returned an error for server ID \`${input.guildId}\`. Re-invite the bot, then run **Member sync** again from the dashboard or admin tools.`,
    );
}
