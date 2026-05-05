export class GuildRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly perMinute: number) {}

  /** @returns true if allowed */
  tryConsume(guildId: string | null): boolean {
    if (!guildId) return true;
    const now = Date.now();
    const windowMs = 60_000;
    let b = this.buckets.get(guildId);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      this.buckets.set(guildId, b);
    }
    if (b.count >= this.perMinute) return false;
    b.count += 1;
    return true;
  }
}
