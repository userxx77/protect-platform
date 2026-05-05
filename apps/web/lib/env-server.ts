export type WebEnvCheck = {
  ready: boolean;
  checks: Record<string, boolean>;
};

/** Server-only env checks (no secrets in response). */
export function evaluateWebProductionEnv(): WebEnvCheck {
  const authSecret = process.env.AUTH_SECRET?.trim();
  const apiBaseUrl = process.env.API_BASE_URL?.trim();
  const discordClientId = process.env.DISCORD_CLIENT_ID?.trim();
  const discordClientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();

  const checks = {
    authSecret: Boolean(authSecret),
    apiBaseUrl: Boolean(apiBaseUrl),
    discordClientId: Boolean(discordClientId),
    discordClientSecret: Boolean(discordClientSecret),
  };

  const ready = Object.values(checks).every(Boolean);
  return { ready, checks };
}
