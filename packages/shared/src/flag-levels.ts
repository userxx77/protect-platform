import { z } from 'zod';

/** Slash/report/flag: actionable tiers only (not Safe / not CLEAN-only). */
export const flagActionLevels = [
  'WATCH',
  'SUSPICIOUS',
  'HIGH_RISK',
  'CONFIRMED_CHEATER',
] as const;

export type FlagActionLevel = (typeof flagActionLevels)[number];

export const FlagActionLevelSchema = z.enum(flagActionLevels);

const DISPLAY: Record<string, string> = {
  CLEAN: 'Safe',
  WATCH: 'Watch',
  SUSPICIOUS: 'Suspicious',
  HIGH_RISK: 'Flagged',
  CONFIRMED_CHEATER: 'Cheater',
};

/** Human-readable label for any FlagLevel or API string. */
export function flagLevelDisplayName(level: string): string {
  return DISPLAY[level] ?? level;
}

/** Discord slash `addChoices` tuples: user-facing name → enum value. */
export const discordSlashLevelChoices: ReadonlyArray<{
  name: string;
  value: FlagActionLevel;
}> = [
  { name: 'Watch', value: 'WATCH' },
  { name: 'Suspicious', value: 'SUSPICIOUS' },
  { name: 'Flagged', value: 'HIGH_RISK' },
  { name: 'Cheater', value: 'CONFIRMED_CHEATER' },
];
