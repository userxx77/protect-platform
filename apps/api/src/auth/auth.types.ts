/** Effective roles after resolution (includes derived TRUSTED). */
export enum AppRole {
  ADMIN = 'ADMIN',
  TRUSTED = 'TRUSTED',
  USER = 'USER',
  BOT = 'BOT',
}

export type AuthIdentity =
  | { kind: 'bot' }
  | { kind: 'user'; discordId: string };

export interface RequestPrincipal {
  identity: AuthIdentity;
  roles: AppRole[];
}
