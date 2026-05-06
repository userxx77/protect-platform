/**
 * Skip the generic NextAuth sign-in page and send users straight to Discord OAuth.
 */
export function discordSignInPath(callbackPath: string): string {
  const pathname = callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`;
  return `/api/auth/signin/discord?${new URLSearchParams({ callbackUrl: pathname })}`;
}
