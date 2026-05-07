import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import type { NextAuthConfig } from 'next-auth';
import { canManageGuildDiscordPermissions } from '@/lib/discord-guilds';

/** Read at request time — avoids empty values if the module was evaluated before env was ready. */
function envTrim(name: string): string | undefined {
  const v = process.env[name];
  if (v == null || typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function authSecret(): string | undefined {
  return (
    envTrim('AUTH_SECRET') ||
    envTrim('NEXTAUTH_SECRET') ||
    envTrim('DASHBOARD_JWT_SECRET') ||
    envTrim('JWT_SECRET')
  );
}

/**
 * Lazy config so Route Handlers call `setEnvDefaults` + Auth with fresh `process.env`
 * (static module scope can be wrong in some Next/server bundles).
 */
function createAuthConfig(): NextAuthConfig {
  return {
    basePath: '/api/auth',
    providers: [
      Discord({
        clientId: envTrim('DISCORD_CLIENT_ID') ?? '',
        clientSecret: envTrim('DISCORD_CLIENT_SECRET') ?? '',
        authorization: {
          params: { scope: 'identify email guilds' },
        },
      }),
    ],
    secret: authSecret(),
    trustHost: true,
    callbacks: {
      async jwt({ token, profile, account }) {
        if (profile && typeof profile === 'object' && 'id' in profile && profile.id) {
          token.discordId = String(profile.id);
        }
        if (account?.access_token) {
          try {
            const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
              headers: { Authorization: `Bearer ${account.access_token}` },
            });
            if (res.ok) {
              const guilds = (await res.json()) as Array<{
                id: string;
                name: string;
                permissions: string;
              }>;
              token.manageableGuilds = guilds
                .filter((g) => canManageGuildDiscordPermissions(g.permissions))
                .map((g) => ({ id: g.id, name: g.name }));
            } else {
              token.manageableGuilds = [];
            }
          } catch {
            token.manageableGuilds = [];
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (token.discordId) {
          session.user.id = String(token.discordId);
        }
        session.manageableGuilds = Array.isArray(token.manageableGuilds)
          ? (token.manageableGuilds as { id: string; name: string }[])
          : [];
        return session;
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(
  async (_req) => createAuthConfig(),
);
