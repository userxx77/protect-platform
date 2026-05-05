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
import {
  sentraAdminCommandData,
  executeSentraAdmin,
} from '../commands/sentra-admin';
import { onGuildMemberAdd } from '../events/guildMemberAdd';
import { onGuildJoined, onGuildRemoved } from '../events/guildJoinLeave';

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

  client.on(Events.GuildCreate, (guild) => {
    setImmediate(() => {
      void onGuildJoined(guild, api).catch((err) =>
        botLog('error', 'guild_create_handler', { error: String(err) }),
      );
    });
  });

  client.on(Events.GuildDelete, (guild) => {
    setImmediate(() => {
      void onGuildRemoved(guild, api).catch((err) =>
        botLog('error', 'guild_delete_handler', { error: String(err) }),
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
      } else if (i.commandName === 'sentra-admin') {
        await executeSentraAdmin(i, api, env);
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

/**
 * Ensures slash commands exist in exactly one scope:
 * - Guild mode: clears ALL global commands; clears guild command lists for every
 *   guild the bot is in; then registers only in DISCORD_GUILD_ID.
 * - Global mode: clears guild-scoped command lists for every guild the bot is in
 *   (removes stale copies that stack with global), then registers globally only.
 *
 * Must run after Client ready so `client.guilds` is populated for global cleanup.
 */
export async function registerSlashCommands(env: Env, client: Client): Promise<void> {
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
  const appId = env.DISCORD_APPLICATION_ID;
  const body = [
    checkCommandData.toJSON(),
    reportCommandData.toJSON(),
    flagCommandData.toJSON(),
    helpCommandData.toJSON(),
    configCommandData.toJSON(),
    sentraAdminCommandData.toJSON(),
  ];
  const maxAttempts = 10;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (env.DISCORD_GUILD_ID) {
        await rest.put(Routes.applicationCommands(appId), { body: [] });
        botLog('info', 'slash_cleared_global_before_guild', {
          attempt,
          guildId: env.DISCORD_GUILD_ID,
        });
        const guildsForClear = [...client.guilds.cache.values()];
        const paceGuild = guildsForClear.length > 20 ? 75 : guildsForClear.length > 5 ? 35 : 0;
        for (const g of guildsForClear) {
          await rest.put(Routes.applicationGuildCommands(appId, g.id), {
            body: [],
          });
          if (paceGuild) await sleep(paceGuild);
        }
        botLog('info', 'slash_cleared_all_guild_scopes_dev', {
          attempt,
          clearedGuilds: guildsForClear.length,
        });
        await rest.put(
          Routes.applicationGuildCommands(appId, env.DISCORD_GUILD_ID),
          { body },
        );
        botLog('info', 'slash_commands_registered_guild_only', {
          attempt,
          guildId: env.DISCORD_GUILD_ID,
        });
      } else {
        const guilds = [...client.guilds.cache.values()];
        let cleared = 0;
        const paceMs = guilds.length > 20 ? 75 : guilds.length > 5 ? 35 : 0;
        for (const g of guilds) {
          await rest.put(Routes.applicationGuildCommands(appId, g.id), {
            body: [],
          });
          cleared++;
          if (paceMs) await sleep(paceMs);
        }
        botLog('info', 'slash_cleared_guild_scopes', {
          attempt,
          guildCount: cleared,
        });
        await rest.put(Routes.applicationCommands(appId), { body });
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
