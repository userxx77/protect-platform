import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    manageableGuilds: { id: string; name: string }[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    discordId?: string;
    manageableGuilds?: { id: string; name: string }[];
  }
}