import { ActivityType, Client } from 'discord.js';
import type { ApiClient } from './apiClient';

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export async function applyPresenceFromStats(
  client: Client,
  stats: { trackedMemberDistinct: number; guildsActive: number },
): Promise<void> {
  const u = compact.format(stats.trackedMemberDistinct);
  const s = stats.guildsActive;
  await client.user?.setPresence({
    status: 'online',
    activities: [{ name: `${u} users · ${s} servers`, type: ActivityType.Watching }],
  });
}

export async function applyPresenceFallback(client: Client): Promise<void> {
  await client.user?.setPresence({
    status: 'online',
    activities: [{ name: 'Watching communities', type: ActivityType.Watching }],
  });
}

/** Poll public stats and update presence; returns `stop` to clear interval. */
export function startPresenceLoop(
  client: Client,
  api: ApiClient,
  intervalMs: number,
): () => void {
  const tick = async () => {
    try {
      const stats = await api.getPublicStats();
      await applyPresenceFromStats(client, stats);
    } catch {
      await applyPresenceFallback(client);
    }
  };
  void tick();
  const id = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(id);
}
