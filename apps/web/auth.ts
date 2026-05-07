import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import { canManageGuildDiscordPermissions } from '@/lib/discord-guilds';

const authSecret =
  process.env.AUTH_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  process.env.DASHBOARD_JWT_SECRET?.trim() ||
  process.env.JWT_SECRET?.trim();

const discordClientId = process.env.DISCORD_CLIENT_ID?.trim() ?? '';
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET?.trim() ?? '';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: discordClientId,
      clientSecret: discordClientSecret,
      authorization: {
        params: { scope: 'identify email guilds' },
      },
    }),
  ],
  secret: authSecret,
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
  trustHost: true,
});
