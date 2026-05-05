import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Env } from '../config/env';

export const helpCommandData = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Sentra commands and dashboard link');

export async function executeHelp(
  interaction: ChatInputCommandInteraction,
  env: Env,
): Promise<void> {
  const dash = env.WEB_URL?.replace(/\/$/, '') ?? 'your dashboard (see operator guide)';
  await interaction.reply({
    ephemeral: true,
    content: [
      '**Sentra (Protect)** — reputation & reports',
      '',
      '`/check` — look up a user',
      '`/report` — submit a community report',
      '`/flag` — trusted flag (API enforces permissions)',
      '`/config` — alert channel / level (needs **Manage Server**)',
      '',
      `Dashboard: ${dash}`,
    ].join('\n'),
  });
}
