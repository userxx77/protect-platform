import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ColorResolvable,
} from 'discord.js';
import { shouldAlert } from './alerts';
import { SENTRA_WARNING } from '../embeds/sentra';

export const JOIN_HOLD_BUTTON_RE = /^sjh:([kbr]):(\d{17,20}):(\d{17,20})$/;

const levelColors: Record<string, ColorResolvable> = {
  CLEAN: 0x34d399,
  SUSPICIOUS: 0xfbbf24,
  HIGH_RISK: 0xfb923c,
  CONFIRMED_CHEATER: 0xf87171,
};

export function displayFlagLevel(level: string): string {
  const map: Record<string, string> = {
    CLEAN: 'Safe',
    SUSPICIOUS: 'Suspicious',
    HIGH_RISK: 'Flagged',
    CONFIRMED_CHEATER: 'Cheater',
  };
  return map[level] ?? level;
}

export type ServerConfigLike = {
  joinHoldEnabled?: boolean;
  joinHoldDurationMinutes?: number;
  joinHoldMinLevel?: string;
};

export function shouldApplyJoinHold(
  config: ServerConfigLike,
  userFlagLevel: string,
): boolean {
  if (!config.joinHoldEnabled) return false;
  const min = config.joinHoldMinLevel ?? 'SUSPICIOUS';
  return shouldAlert(userFlagLevel, min);
}

export function parseJoinHoldButtonId(
  customId: string,
): { action: 'k' | 'b' | 'r'; guildId: string; userId: string } | null {
  const m = customId.match(JOIN_HOLD_BUTTON_RE);
  if (!m) return null;
  return { action: m[1] as 'k' | 'b' | 'r', guildId: m[2], userId: m[3] };
}

export function joinHoldModerationEmbed(input: {
  memberTag: string;
  guildName: string;
  user: {
    discordId: string;
    flagLevel: string;
    flagScore: number;
    flagCount?: number;
  };
  timeoutApplied: boolean;
  timeoutMinutes: number;
}): EmbedBuilder {
  const color =
    levelColors[input.user.flagLevel] ?? SENTRA_WARNING;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle('Join quarantine · staff review')
    .setDescription(
      input.timeoutApplied
        ? `Member is in a **communication timeout** (${input.timeoutMinutes} minute(s)) until staff act. Use **Kick**, **Ban**, or **Release** (clear timeout).`
        : `**Timeout was not applied** — check that the bot has **Moderate Members** and a role **above** the joiner. Staff can still use the actions below.`,
    )
    .addFields(
      {
        name: 'Member',
        value: `${input.memberTag} · <@${input.user.discordId}> · \`${input.user.discordId}\``,
        inline: false,
      },
      { name: 'Server', value: input.guildName, inline: true },
      {
        name: 'Sentra level',
        value: displayFlagLevel(input.user.flagLevel),
        inline: true,
      },
      { name: 'Score', value: String(input.user.flagScore), inline: true },
      {
        name: 'Flags',
        value:
          input.user.flagCount != null ? String(input.user.flagCount) : '—',
        inline: true,
      },
    )
    .setFooter({
      text: 'Sentra · join hold — only trusted staff should act',
    })
    .setTimestamp(new Date());
}

export function joinHoldActionRow(
  guildId: string,
  targetUserId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`sjh:k:${guildId}:${targetUserId}`)
      .setLabel('Kick')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`sjh:b:${guildId}:${targetUserId}`)
      .setLabel('Ban')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`sjh:r:${guildId}:${targetUserId}`)
      .setLabel('Release')
      .setStyle(ButtonStyle.Success),
  );
}

export function joinHoldDisabledRow(
  guildId: string,
  targetUserId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`sjh:k:${guildId}:${targetUserId}`)
      .setLabel('Kick')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`sjh:b:${guildId}:${targetUserId}`)
      .setLabel('Ban')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`sjh:r:${guildId}:${targetUserId}`)
      .setLabel('Release')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
  );
}
