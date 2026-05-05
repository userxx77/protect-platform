import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import { canManageGuildDiscordPermissions } from '@/lib/discord-guilds';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
      authorization: {
        params: { scope: 'identify email guilds' },
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
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