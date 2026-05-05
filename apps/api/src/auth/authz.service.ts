import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseAdminDiscordIds } from '@protect/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppRole, type AuthIdentity, type RequestPrincipal } from './auth.types';

@Injectable()
export class AuthzService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolvePrincipal(identity: AuthIdentity): Promise<RequestPrincipal> {
    if (identity.kind === 'bot') {
      return { identity, roles: [AppRole.BOT] };
    }

    const discordId = identity.discordId;
    const roles = new Set<AppRole>();

    const legacyAdmins = parseAdminDiscordIds(
      this.config.get<string>('ADMIN_DISCORD_IDS'),
    );
    if (legacyAdmins.includes(discordId)) {
      roles.add(AppRole.ADMIN);
      roles.add(AppRole.USER);
    }

    const account = await this.prisma.platformAccount.findUnique({
      where: { discordUserId: discordId },
    });
    if (account?.role === 'ADMIN') {
      roles.add(AppRole.ADMIN);
      roles.add(AppRole.USER);
    } else if (account?.role === 'USER') {
      roles.add(AppRole.USER);
    } else if (!roles.has(AppRole.USER)) {
      roles.add(AppRole.CHECKER);
    }

    const trusted = await this.prisma.trustedUser.findUnique({
      where: { discordUserId: discordId },
    });
    if (trusted) {
      roles.add(AppRole.TRUSTED);
    }

    return { identity, roles: [...roles] };
  }

  principalHasAnyRole(principal: RequestPrincipal, required: AppRole[]): boolean {
    if (!required.length) return true;
    const have = new Set(principal.roles);
    return required.some((r) => have.has(r));
  }
}
