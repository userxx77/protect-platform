export type ServerConfigCacheEntry<T> = {
  data: T;
  fetchedAt: number;
  expiresAt: number;
};

export class ServerConfigCache<T> {
  private readonly store = new Map<string, ServerConfigCacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(guildId: string): ServerConfigCacheEntry<T> | undefined {
    return this.store.get(guildId);
  }

  set(guildId: string, data: T): void {
    const now = Date.now();
    this.store.set(guildId, {
      data,
      fetchedAt: now,
      expiresAt: now + this.ttlMs,
    });
  }

  invalidate(guildId: string): void {
    this.store.delete(guildId);
  }

  isFresh(entry: ServerConfigCacheEntry<T>): boolean {
    return Date.now() < entry.expiresAt;
  }
}
