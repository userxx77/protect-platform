import type { Client, TextChannel } from 'discord.js';
import { baseEmbed } from '../embeds/sentra';
import type { Env } from '../config/env';
import { botLog } from '../log';

export async function sendAdminFeedMessage(
  client: Client,
  env: Env,
  title: string,
  body: string,
): Promise<void> {
  const chId = env.DISCORD_ADMIN_FEED_CHANNEL_ID;
  if (!chId) return;
  try {
    const ch = await client.channels.fetch(chId);
    if (!ch || !('send' in ch)) return;
    await (ch as TextChannel).send({
      embeds: [baseEmbed().setTitle(title).setDescription(body)],
    });
  } catch (e) {
    botLog('warn', 'admin_feed_send_failed', { error: String(e) });
  }
}
