import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    }),
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async jwt({ token, profile }) {
      if (profile && typeof profile === 'object' && 'id' in profile && profile.id) {
        token.discordId = String(profile.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.discordId) {
        session.user.id = String(token.discordId);
      }
      return session;
    },
  },
  trustHost: true,
});
