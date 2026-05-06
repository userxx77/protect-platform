import {
  type ButtonInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { botLog } from '../log';
import {
  joinHoldDisabledRow,
  JOIN_HOLD_BUTTON_RE,
  parseJoinHoldButtonId,
} from '../services/joinHold';

export function isJoinHoldButton(customId: string): boolean {
  return JOIN_HOLD_BUTTON_RE.test(customId);
}

export async function executeJoinHoldButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const parsed = parseJoinHoldButtonId(interaction.customId);
  if (!parsed || parsed.guildId !== interaction.guildId) {
    await interaction.reply({
      ephemeral: true,
      content: 'This action is invalid or was created in another server.',
    });
    return;
  }
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      ephemeral: true,
      content: 'Use this button inside the server.',
    });
    return;
  }

  const perms = interaction.memberPermissions;
  if (!perms) {
    await interaction.reply({
      ephemeral: true,
      content: 'Could not read your permissions.',
    });
    return;
  }

  if (parsed.action === 'k' && !perms.has(PermissionFlagsBits.KickMembers)) {
    await interaction.reply({
      ephemeral: true,
      content: 'You need **Kick Members** to remove this member.',
    });
    return;
  }
  if (parsed.action === 'b' && !perms.has(PermissionFlagsBits.BanMembers)) {
    await interaction.reply({
      ephemeral: true,
      content: 'You need **Ban Members** to ban this account.',
    });
    return;
  }
  if (parsed.action === 'r' && !perms.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({
      ephemeral: true,
      content:
        'You need **Moderate Members** to clear a communication timeout.',
    });
    return;
  }

  const target = await interaction.guild.members
    .fetch(parsed.userId)
    .catch(() => null);
  if (!target) {
    await interaction.reply({
      ephemeral: true,
      content: 'That member is no longer in the server.',
    });
    return;
  }

  const outcomeLabel =
    parsed.action === 'k' ? 'Kicked' : parsed.action === 'b' ? 'Banned' : 'Released';

  try {
    if (parsed.action === 'k') {
      await target.kick('Sentra: join hold — staff action');
    } else if (parsed.action === 'b') {
      await target.ban({
        deleteMessageSeconds: 0,
        reason: 'Sentra: join hold — staff action',
      });
    } else {
      await target.timeout(null, 'Sentra: released from join hold');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    botLog('warn', 'join_hold_action_failed', {
      guildId: parsed.guildId,
      targetId: parsed.userId,
      action: parsed.action,
      error: msg.slice(0, 400),
    });
    await interaction.reply({
      ephemeral: true,
      content: `Could not complete that action. ${msg.slice(0, 350)}`,
    });
    return;
  }

  const prev = interaction.message?.embeds?.[0];
  const embed = prev ? EmbedBuilder.from(prev) : new EmbedBuilder();
  embed.addFields({
    name: 'Outcome',
    value: `**${outcomeLabel}** by ${interaction.user} (\`${interaction.user.tag}\`)`,
  });

  await interaction.update({
    embeds: [embed],
    components: [joinHoldDisabledRow(parsed.guildId, parsed.userId)],
  });
}
