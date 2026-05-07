import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ColorResolvable,
} from 'discord.js';
import { flagLevelDisplayName } from '@protect/shared';
import { shouldAlert } from './alerts';
import {
  SENTRA_DANGER,
  SENTRA_SUCCESS,
  SENTRA_WARNING,
  commandFooter,
} from '../embeds/sentra';

export const JOIN_HOLD_BUTTON_RE = /^sjh:([kbr]):(\d{17,20}):(\d{17,20})$/;

const levelColors: Record<string, ColorResolvable> = {
  CLEAN: SENTRA_SUCCESS,
  SUSPICIOUS: SENTRA_WARNING,
  HIGH_RISK: 0xe67e22,
  CONFIRMED_CHEATER: SENTRA_DANGER,
};

export { flagLevelDisplayName as displayFlagLevel } from '@protect/shared';

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
  const color = levelColors[input.user.flagLevel] ?? SENTRA_WARNING;
  const timeoutLine = input.timeoutApplied
    ? `Timeout **${input.timeoutMinutes}m** active — Kick / Ban / Release below.`
    : '**No timeout** — bot needs **Moderate Members** and a role **above** the member. Buttons still work.';
  return new EmbedBuilder()
    .setColor(color)
    .setTitle('Join hold')
    .setDescription(timeoutLine)
    .addFields(
      {
        name: 'Member',
        value: `${input.memberTag} · <@${input.user.discordId}> · \`${input.user.discordId}\``,
        inline: false,
      },
      {
        name: 'Server',
        value: input.guildName,
        inline: true,
      },
      {
        name: 'Level',
        value: flagLevelDisplayName(input.user.flagLevel),
        inline: true,
      },
      { name: 'Score', value: String(input.user.flagScore), inline: true },
      {
        name: 'Flags',
        value: input.user.flagCount != null ? String(input.user.flagCount) : '—',
        inline: true,
      },
    )
    .setFooter(commandFooter())
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
