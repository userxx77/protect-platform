import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LicenseStatus, MemberSyncState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EntitlementsService {
  private readonly licensedGuildAllowlist: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const raw = config.get<string>('SENTRA_LICENSED_GUILD_IDS')?.trim() ?? '';
    this.licensedGuildAllowlist = new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((id) => /^\d{17,20}$/.test(id)),
    );
  }

  /** Active license: TRIAL or ACTIVE, within validFrom/validUntil window. */
  async isGuildLicensed(guildId: string): Promise<boolean> {
    if (this.licensedGuildAllowlist.has(guildId)) return true;
    const row = await this.prisma.guildEntitlement.findUnique({
      where: { guildId },
    });
    if (!row) return false;
    return this.rowIsActive(row);
  }

  rowIsActive(row: {
    status: LicenseStatus;
    validFrom: Date;
    validUntil: Date | null;
  }): boolean {
    if (row.status !== LicenseStatus.TRIAL && row.status !== LicenseStatus.ACTIVE) {
      return false;
    }
    const now = new Date();
    if (row.validFrom > now) return false;
    if (row.validUntil !== null && row.validUntil < now) return false;
    return true;
  }

  async upsertEntitlement(input: {
    guildId: string;
    status: LicenseStatus;
    validFrom: Date;
    validUntil: Date | null;
    planCode?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    createdByDiscordId?: string | null;
  }): Promise<void> {
    await this.prisma.guildEntitlement.upsert({
      where: { guildId: input.guildId },
      create: {
        guildId: input.guildId,
        status: input.status,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        planCode: input.planCode ?? null,
        stripeCustomerId: input.stripeCustomerId ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        createdByDiscordId: input.createdByDiscordId ?? null,
      },
      update: {
        status: input.status,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        planCode: input.planCode ?? undefined,
        stripeCustomerId: input.stripeCustomerId ?? undefined,
        stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
        createdByDiscordId: input.createdByDiscordId ?? undefined,
      },
    });
  }

  async setMemberSyncState(guildId: string, state: MemberSyncState): Promise<void> {
    await this.prisma.guildEntitlement.updateMany({
      where: { guildId },
      data: { memberSyncState: state },
    });
  }
}
