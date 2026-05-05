export type UserApiResponse = {
  discordId: string;
  flagScore: number;
  flagLevel: string;
  flagCount?: number;
  updatedAt: string;
};

export type ServerApiResponse = {
  guildId: string;
  config: {
    alertChannelId?: string;
    alertMinLevel?: string;
    mentionRoleIds?: string[];
  };
  updatedAt: string | null;
};
