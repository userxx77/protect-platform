import { Events } from 'discord.js';
import * as http from 'node:http';
import { loadEnv } from './config/env';
import { ApiClient } from './services/apiClient';
import { createDiscordClient, registerSlashCommands } from './client/discordClient';
import { waitForApiReady } from './client/apiReadiness';
import { startEventSubscriber } from './services/eventSubscriber';
import { startPresenceLoop } from './services/presence';
import { botLog } from './log';

function startBotHealth(port: number): void {
  http
    .createServer((req, res) => {
      if (req.url === '/health' || req.url === '/ready') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, service: 'protect-bot' }));
        return;
      }
      res.writeHead(404);
      res.end();
    })
    .listen(port, '0.0.0.0', () => {
      botLog('info', 'bot_health_listen', { port });
    });
}

async function main() {
  const env = loadEnv();
  const api = new ApiClient(env);
  const rawApiBase = env.API_BASE_URL.replace(/\/$/, '');
  await waitForApiReady(rawApiBase, { maxAttempts: 60, backoffMs: 2000 });

  let subStop: { stop: () => Promise<void> } | null = null;
  const client = createDiscordClient(api, env);
  let stopPresence: (() => void) | undefined;
  client.once(Events.ClientReady, async () => {
    try {
      await registerSlashCommands(env, client);
    } catch (e) {
      botLog('error', 'slash_sync_failed', { error: String(e) });
    }
    if (env.REDIS_URL !== undefined && env.REDIS_URL.length > 0) {
      subStop = startEventSubscriber(env.REDIS_URL, api, client, env, {
        dedupe: env.BOT_EVENT_DEDUPE,
      });
    } else {
      botLog('warn', 'redis_url_missing_subscriber_disabled', {
        msg: 'Member sync and domain-event fan-out require REDIS_URL on the bot.',
      });
    }
    if (env.BOT_HEALTH_PORT != null) {
      startBotHealth(env.BOT_HEALTH_PORT!);
    }
    stopPresence = startPresenceLoop(client, api, 300_000);
  });
  await client.login(env.DISCORD_BOT_TOKEN);

  const shutdown = async () => {
    botLog('info', 'bot_shutdown', {});
    stopPresence?.();
    await subStop?.stop();
    client.destroy();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((e) => {
  botLog('error', 'bot_fatal', { error: String(e) });
  process.exit(1);
});
