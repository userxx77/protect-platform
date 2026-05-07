/**
 * Entry URL for Discord OAuth. Auth.js v5 rejects GET /api/auth/signin/:provider;
 * we use a Server Component that calls signIn() (POST internally).
 */
export function discordSignInPath(callbackPath: string): string {
  const pathname = callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`;
  return `/auth/discord?${new URLSearchParams({ callbackUrl: pathname })}`;
}
