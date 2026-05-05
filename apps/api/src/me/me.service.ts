import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthzService } from '../auth/authz.service';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly authz: AuthzService,
  ) {}

  async resolveGuilds(guildIds: string[]) {
    const rows = await this.prisma.server.findMany({
      where: { guildId: { in: guildIds } },
      include: { entitlement: true },
    });
    const byId = new Map(rows.map((r) => [r.guildId, r]));

    return {
      items: guildIds.map((id) => {
        const r = byId.get(id);
        if (!r) {
          return {
            guildId: id,
            known: false as const,
            licensed: false as const,
          };
        }
        const licensed = r.entitlement
          ? this.entitlements.rowIsActive(r.entitlement)
          : false;
        return {
          guildId: id,
          known: true as const,
          licensed,
          discordName: r.discordName,
          approximateMemberCount: r.approximateMemberCount,
          entitlement: r.entitlement
            ? {
                status: r.entitlement.status,
                validUntil: r.entitlement.validUntil?.toISOString() ?? null,
              }
            : null,
        };
      }),
    };
  }

  /**
   * Non-admin callers must pass the same guild id in `manageableGuildIds` (comma list)
   * — typically Discord "Manage Server" guilds from the dashboard session.
   */
  async listGuildMembers(
    guildId: string,
    principal: RequestPrincipal,
    manageableGuildIds: string,
  ) {
    const isAdmin = this.authz.principalHasAnyRole(principal, [AppRole.ADMIN]);
    if (!isAdmin) {
      const allowed = manageableGuildIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!allowed.includes(guildId)) {
        throw new ForbiddenException('Guild not in your manageable list');
      }
      const licensed = await this.entitlements.isGuildLicensed(guildId);
      if (!licensed) {
        throw new ForbiddenException('Guild has no active license');
      }
    }

    const rows = await this.prisma.guildMemberCache.findMany({
      where: { guildId },
      orderBy: { firstSeenAt: 'desc' },
      take: 500,
      select: {
        discordUserId: true,
        firstSeenAt: true,
        source: true,
      },
    });

    return {
      guildId,
      items: rows.map((r) => ({
        discordUserId: r.discordUserId,
        firstSeenAt: r.firstSeenAt.toISOString(),
        source: r.source,
      })),
    };
  }
}
