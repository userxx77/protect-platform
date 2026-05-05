import { FlagLevel } from '@prisma/client';
import type { UserPublic } from '@protect/shared';

export function userToPublic(
  u: {
    discordId: string;
    flagScore: number;
    flagLevel: FlagLevel;
    updatedAt: Date;
    stateVersion?: number;
  },
  flagCount?: number,
): UserPublic {
  return {
    discordId: u.discordId,
    flagScore: u.flagScore,
    flagLevel: u.flagLevel as UserPublic['flagLevel'],
    flagCount,
    updatedAt: u.updatedAt.toISOString(),
    ...(u.stateVersion != null ? { stateVersion: u.stateVersion } : {}),
  };
}
