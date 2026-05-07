export type WebEnvCheck = {
  ready: boolean;
  checks: Record<string, boolean>;
};

/** Server-only env checks (no secrets in response). */
export function evaluateWebProductionEnv(): WebEnvCheck {
  const authSecret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  const apiBaseUrl = process.env.API_BASE_URL?.trim();
  const discordClientId = process.env.DISCORD_CLIENT_ID?.trim();
  const discordClientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  const authPublicUrl =
    process.env.NODE_ENV !== 'production' ||
    Boolean(process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim());

  const checks = {
    authSecret: Boolean(authSecret),
    authPublicUrl,
    apiBaseUrl: Boolean(apiBaseUrl),
    discordClientId: Boolean(discordClientId),
    discordClientSecret: Boolean(discordClientSecret),
  };

  const ready = Object.values(checks).every(Boolean);
  return { ready, checks };
}
