import type { Client, GuildMember } from 'discord.js';
import type { ApiClient } from '../services/apiClient';
import { alertEmbed, shouldAlert } from '../services/alerts';
import { botLog } from '../log';
import {
  joinHoldActionRow,
  joinHoldModerationEmbed,
  shouldApplyJoinHold,
  type ServerConfigLike,
} from '../services/joinHold';

export async function onGuildMemberAdd(
  member: GuildMember,
  api: ApiClient,
  client: Client,
): Promise<void> {
  if (!member.guild) return;
  try {
    const [user, server] = await Promise.all([
      api.getUser(member.id),
      api.getServer(member.guild.id),
    ]);
    const cfg = server.config as ServerConfigLike & {
      alertChannelId?: string;
      alertMinLevel?: string;
      mentionRoleIds?: string[];
    };

    const hold = shouldApplyJoinHold(cfg, user.flagLevel);
    const needsSimpleAlert =
      !hold && shouldAlert(user.flagLevel, cfg.alertMinLevel);

    if (!hold && !needsSimpleAlert) return;
    if (!cfg.alertChannelId) return;

    const ch = await client.channels.fetch(cfg.alertChannelId);
    if (!ch || !('send' in ch)) return;
    const mentions =
      cfg.mentionRoleIds?.map((id) => `<@&${id}>`).join(' ') ?? '';

    if (hold) {
      const minutes = cfg.joinHoldDurationMinutes ?? 60;
      const ms = Math.min(
        Math.max(1, minutes) * 60_000,
        28 * 24 * 60 * 60_000 - 60_000,
      );
      let timeoutApplied = true;
      try {
        await member.timeout(
          ms,
          'Sentra: join hold — pending staff review',
        );
      } catch (e) {
        timeoutApplied = false;
        botLog('warn', 'join_hold_timeout_failed', {
          guildId: member.guild.id,
          userId: member.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      const embed = joinHoldModerationEmbed({
        memberTag: member.user.tag,
        guildName: member.guild.name,
        user: {
          discordId: user.discordId,
          flagLevel: user.flagLevel,
          flagScore: user.flagScore,
          flagCount: user.flagCount,
        },
        timeoutApplied,
        timeoutMinutes: minutes,
      });

      await ch.send({
        content: mentions || undefined,
        embeds: [embed],
        components: [joinHoldActionRow(member.guild.id, member.id)],
      });
      return;
    }

    await ch.send({
      content: mentions || undefined,
      embeds: [
        alertEmbed(
          user,
          `**${member.user.tag}** joined **${member.guild.name}** with elevated reputation.`,
        ),
      ],
    });
  } catch {
    /* non-fatal */
  }
}
