import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  type Interaction,
} from 'discord.js';
import type { Env } from '../config/env';
import type { ApiClient } from '../services/apiClient';
import { botLog } from '../log';
import { checkCommandData, executeCheck } from '../commands/check';
import { reportCommandData, executeReport } from '../commands/report';
import { flagCommandData, executeFlag } from '../commands/flag';
import {
  configCommandData,
  executeConfigSet,
  executeConfigView,
} from '../commands/config';
import { helpCommandData, executeHelp } from '../commands/help';
import { onGuildMemberAdd } from '../events/guildMemberAdd';

export function createDiscordClient(api: ApiClient, env: Env): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.GuildMember],
  });

  client.once(Events.ClientReady, (c) => {
    botLog('info', 'discord_client_ready', { tag: c.user.tag });
  });

  client.on(Events.ShardResume, (id, replayed) => {
    botLog('info', 'discord_shard_resume', {
      shardId: id,
      replayedEventCount: replayed,
    });
  });

  client.on(Events.ShardDisconnect, (closeEvent, id) => {
    botLog('warn', 'discord_shard_disconnect', {
      shardId: id,
      code: closeEvent.code,
    });
  });

  client.on(Events.GuildMemberAdd, (member) => {
    setImmediate(() => {
      void onGuildMemberAdd(member, api, client).catch((err) =>
        botLog('error', 'guild_member_add_handler', { error: String(err) }),
      );
    });
  });

  client.on(Events.InteractionCreate, async (i: Interaction) => {
    if (!i.isChatInputCommand()) return;
    try {
      if (i.commandName === 'check') {
        await executeCheck(i, api, client);
      } else if (i.commandName === 'report') {
        await executeReport(i, api);
      } else if (i.commandName === 'flag') {
        await executeFlag(i, api);
      } else if (i.commandName === 'help') {
        await executeHelp(i, env);
      } else if (i.commandName === 'config') {
        const sub = i.options.getSubcommand();
        if (sub === 'view') {
          await executeConfigView(i, api);
        } else if (sub === 'set') {
          await executeConfigSet(i, api);
        }
      }
    } catch (e) {
      botLog('error', 'interaction_handler', { error: String(e) });
      if (i.isRepliable() && !i.replied && !i.deferred) {
        await i.reply({ content: 'Something went wrong.', ephemeral: true });
      }
    }
  });

  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function registerSlashCommands(env: Env): Promise<void> {
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
  const body = [
    checkCommandData.toJSON(),
    reportCommandData.toJSON(),
    flagCommandData.toJSON(),
    helpCommandData.toJSON(),
    configCommandData.toJSON(),
  ];
  const maxAttempts = 10;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Register in ONE scope only. Doing both global + guild shows duplicate
      // slash commands in that guild (same names appear twice in the picker).
      if (env.DISCORD_GUILD_ID) {
        await rest.put(
          Routes.applicationGuildCommands(
            env.DISCORD_APPLICATION_ID,
            env.DISCORD_GUILD_ID,
          ),
          { body },
        );
        botLog('info', 'slash_commands_registered_guild_only', {
          attempt,
          guildId: env.DISCORD_GUILD_ID,
        });
      } else {
        await rest.put(Routes.applicationCommands(env.DISCORD_APPLICATION_ID), {
          body,
        });
        botLog('info', 'slash_commands_registered_global', { attempt });
      }
      return;
    } catch (e) {
      lastErr = e;
      botLog('warn', 'slash_commands_register_retry', {
        attempt,
        maxAttempts,
        error: String(e).slice(0, 500),
      });
      if (attempt < maxAttempts) {
        await sleep(Math.min(30_000, 2000 * attempt));
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
