import { EmbedBuilder, type ColorResolvable } from 'discord.js';
import { flagLevelDisplayName } from '@protect/shared';

/** Stripe colors — distinct states, not loud marketing purple everywhere */
export const BRAND_PRIMARY = 0x5865f2;
export const SENTRA_PRIMARY = BRAND_PRIMARY;
export const SENTRA_SUCCESS = 0x3ba55d;
export const SENTRA_WARNING = 0xf0b232;
export const SENTRA_DANGER = 0xed4245;
export const SENTRA_INFO = 0x00b0f4;

/** User-facing slash replies */
export function commandFooter(): { text: string } {
  return { text: 'Sentra' };
}

/** Operator / admin feed */
export function feedFooter(): { text: string } {
  return { text: 'Sentra — ops' };
}

/** @deprecated use commandFooter — kept for imports */
export function productFooter(): { text: string } {
  return commandFooter();
}

/** @deprecated use feedFooter */
export function sentraFooter(): { text: string } {
  return feedFooter();
}

export function guildIconUrl(
  guildId: string,
  iconHash: string | null | undefined,
): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}`;
}

export function baseCommandEmbed(color: ColorResolvable = SENTRA_PRIMARY): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setFooter(commandFooter()).setTimestamp(new Date());
}

/** Redis / staff channel system events */
export function baseFeedEmbed(color: ColorResolvable = SENTRA_PRIMARY): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setFooter(feedFooter()).setTimestamp(new Date());
}

/** @deprecated use baseFeedEmbed */
export function baseEmbed(color: ColorResolvable = SENTRA_PRIMARY): EmbedBuilder {
  return baseFeedEmbed(color);
}

export function embedGuildDiscovered(input: {
  guildId: string;
  name: string | null;
  approximateMemberCount: number | null;
  iconHash?: string | null;
}): EmbedBuilder {
  const name = input.name ?? 'Unknown server';
  const e = baseFeedEmbed(SENTRA_SUCCESS)
    .setTitle('Server added')
    .setDescription(`${name} — run \`/setup alerts\` for staff notifications.`)
    .addFields(
      { name: 'ID', value: `\`${input.guildId}\``, inline: true },
      {
        name: 'Members',
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
  allegedFlagLevel?: string | null;
  guildName?: string | null;
  guildIconUrl?: string | null;
}): EmbedBuilder {
  const target = input.targetDiscordId ? `<@${input.targetDiscordId}>` : '—';
  const reporter = input.reporterDiscordId ? `<@${input.reporterDiscordId}>` : '—';
  const server =
    input.guildName && input.guildId
      ? `${input.guildName} · \`${input.guildId}\``
      : input.guildId
        ? `\`${input.guildId}\``
        : '—';
  const rawReason = input.reason?.trim() ?? '';
  const reason =
    rawReason.length > 0
      ? rawReason.length > 950
        ? `${rawReason.slice(0, 947)}…`
        : rawReason
      : '—';
  const tier =
    input.allegedFlagLevel != null && input.allegedFlagLevel !== ''
      ? flagLevelDisplayName(input.allegedFlagLevel)
      : '—';

  const e = baseFeedEmbed(SENTRA_WARNING)
    .setTitle('Report awaiting review')
    .setDescription('Approve or reject in the dashboard before reputation changes.')
    .addFields(
      { name: 'ID', value: `\`${input.reportId ?? '—'}\``, inline: true },
      { name: 'Reporter tier', value: tier, inline: true },
      { name: 'Server', value: server, inline: true },
      { name: 'Target', value: target, inline: true },
      { name: 'From', value: reporter, inline: true },
      { name: 'Details', value: reason, inline: false },
    );

  if (input.guildIconUrl) e.setThumbnail(input.guildIconUrl);
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
      ? 'Ticket opened'
      : input.kind === 'support.ticket.evidence_submitted'
        ? 'Evidence in'
        : input.kind === 'support.ticket.resolved' && input.status === 'REJECTED'
          ? 'Ticket rejected'
          : input.kind === 'support.ticket.resolved'
            ? 'Ticket closed'
            : 'Ticket';
  const color =
    input.kind === 'support.ticket.resolved' && input.status !== 'REJECTED'
      ? SENTRA_SUCCESS
      : SENTRA_WARNING;
  const e = baseFeedEmbed(color).setTitle(title);
  const lines: string[] = [];
  lines.push(`Ticket \`${input.ticketId ?? '—'}\` · Report \`${input.reportId ?? '—'}\``);
  if (input.reporterDiscordId) lines.push(`Reporter <@${input.reporterDiscordId}>`);
  if (input.guildId) lines.push(`Guild \`${input.guildId}\``);
  if (input.status) lines.push(`Status ${input.status}`);
  if (input.kind === 'support.ticket.evidence_submitted') {
    lines.push(`Files ${input.attachmentCount ?? 0} · Links ${input.linkCount ?? 0}`);
  }
  return e.setDescription(lines.join('\n'));
}

export function embedMemberSyncStarted(input: {
  guildId: string;
  guildName: string;
  iconHash?: string | null;
}): EmbedBuilder {
  const e = baseFeedEmbed(SENTRA_PRIMARY)
    .setTitle('Member sync started')
    .setDescription(`${input.guildName} · \`${input.guildId}\``);
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
  const e = baseFeedEmbed(SENTRA_SUCCESS)
    .setTitle('Member sync done')
    .setDescription(
      `${input.guildName} · ${input.memberCount.toLocaleString('en-US')} profiles cached · \`${input.guildId}\``,
    );
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
  const head = input.guildName
    ? `${input.guildName} · \`${input.guildId}\``
    : `\`${input.guildId}\``;
  const e = baseFeedEmbed(SENTRA_DANGER)
    .setTitle('Member sync failed')
    .setDescription(head)
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
  return baseFeedEmbed(SENTRA_WARNING)
    .setTitle('Sync skipped')
    .setDescription(
      `Bot is not in this server or Discord returned an error for \`${input.guildId}\`. Re-invite the bot, then retry sync.`,
    );
}
