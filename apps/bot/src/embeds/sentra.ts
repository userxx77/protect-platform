import { EmbedBuilder, type ColorResolvable } from 'discord.js';

export const SENTRA_PRIMARY = 0x5865f2;
export const SENTRA_SUCCESS = 0x57f287;
export const SENTRA_WARNING = 0xfee75c;
export const SENTRA_DANGER = 0xed4245;

const FOOTER = 'Sentra · operator feed';
const FOOTER_PRODUCT = 'Sentra · reputation & reports';

export function sentraFooter(): { text: string } {
  return { text: FOOTER };
}

/** Footer for user-facing slash command embeds (non-operator feed). */
export function productFooter(): { text: string } {
  return { text: FOOTER_PRODUCT };
}

/** Discord CDN guild icon (png); pass guild id and icon hash from API/bot. */
export function guildIconUrl(guildId: string, iconHash: string | null | undefined): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}`;
}

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
    .setTitle('New server')
    .setDescription(`**${input.name ?? 'Unknown guild'}** added Sentra.`)
    .addFields(
      { name: 'Guild ID', value: `\`${input.guildId}\``, inline: true },
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
}): EmbedBuilder {
  return baseEmbed(SENTRA_WARNING)
    .setTitle('Report pending review')
    .addFields(
      { name: 'Report', value: `\`${input.reportId ?? '—'}\``, inline: true },
      {
        name: 'Target',
        value: input.targetDiscordId
          ? `<@${input.targetDiscordId}> \`${input.targetDiscordId}\``
          : '—',
        inline: false,
      },
      {
        name: 'Reporter',
        value: input.reporterDiscordId ? `<@${input.reporterDiscordId}>` : '—',
        inline: true,
      },
      {
        name: 'Guild',
        value: input.guildId ? `\`${input.guildId}\`` : '—',
        inline: true,
      },
    );
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
        ? 'Ticket evidence submitted'
        : input.kind === 'support.ticket.resolved' && input.status === 'REJECTED'
          ? 'Ticket rejected'
          : input.kind === 'support.ticket.resolved'
            ? 'Ticket resolved'
            : 'Ticket event';
  const color =
    input.kind === 'support.ticket.resolved' && input.status !== 'REJECTED'
      ? SENTRA_SUCCESS
      : SENTRA_WARNING;
  const e = baseEmbed(color).setTitle(title);
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Ticket', value: `\`${input.ticketId ?? '—'}\``, inline: true },
    { name: 'Report', value: `\`${input.reportId ?? '—'}\``, inline: true },
  ];
  if (input.reporterDiscordId) {
    fields.push({
      name: 'Reporter',
      value: `<@${input.reporterDiscordId}>`,
      inline: true,
    });
  }
  if (input.guildId) {
    fields.push({ name: 'Guild', value: `\`${input.guildId}\``, inline: true });
  }
  if (input.status) {
    fields.push({ name: 'Status', value: input.status, inline: true });
  }
  if (input.kind === 'support.ticket.evidence_submitted') {
    fields.push({
      name: 'Evidence',
      value: `${input.attachmentCount ?? 0} image(s), ${input.linkCount ?? 0} link(s)`,
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
    .setTitle('Member sync started')
    .setDescription(`Fetching members for **${input.guildName}**.`)
    .addFields({ name: 'Guild ID', value: `\`${input.guildId}\``, inline: false });
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
    .setTitle('Member sync complete')
    .setDescription(`**${input.guildName}** — cached **${input.memberCount}** members.`)
    .addFields({ name: 'Guild ID', value: `\`${input.guildId}\``, inline: false });
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
    .setTitle('Member sync failed')
    .setDescription(
      `${input.guildName ? `**${input.guildName}** — ` : ''}\`${input.guildId}\``,
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
      `Bot is not in this server or the guild is unavailable: \`${input.guildId}\`. Re-invite the bot or retry after reconnect.`,
    );
}
