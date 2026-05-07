import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ActorKind, LicenseKeyStatus, LicenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { AuthzService } from '../auth/authz.service';

function parseManageableGuildIds(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((id) => /^\d{17,20}$/.test(id));
}

function normalizeLicenseCode(raw: string): string {
  return raw.trim().toLowerCase();
}

@Injectable()
export class LicenseKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authz: AuthzService,
  ) {}

  private assertAdmin(principal: RequestPrincipal): string {
    if (!this.authz.principalHasAnyRole(principal, [AppRole.ADMIN])) {
      throw new ForbiddenException();
    }
    if (principal.identity.kind !== 'user') {
      throw new ForbiddenException();
    }
    return principal.identity.discordId;
  }

  private assertUserOrAdmin(principal: RequestPrincipal): string {
    if (principal.identity.kind !== 'user') {
      throw new ForbiddenException();
    }
    if (!this.authz.principalHasAnyRole(principal, [AppRole.USER, AppRole.ADMIN])) {
      throw new ForbiddenException('Redeem requires User role');
    }
    return principal.identity.discordId;
  }

  async generateKeys(
    principal: RequestPrincipal,
    input: {
      count: number;
      planCode?: string | null;
      presetValidDays?: number | null;
      notes?: string | null;
    },
  ) {
    const actor = this.assertAdmin(principal);
    const count = Math.min(100, Math.max(1, Math.floor(input.count)));
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      let code: string;
      let attempts = 0;
      do {
        code = `sentra-${randomBytes(4).toString('hex')}`;
        const exists = await this.prisma.licenseKey.findUnique({
          where: { code },
          select: { id: true },
        });
        if (!exists) break;
        attempts += 1;
      } while (attempts < 8);
      if (attempts >= 8) {
        throw new ConflictException('Could not generate unique code');
      }
      await this.prisma.licenseKey.create({
        data: {
          code,
          status: LicenseKeyStatus.UNUSED,
          planCode: input.planCode?.trim() || null,
          presetValidDays:
            input.presetValidDays != null && Number.isFinite(input.presetValidDays)
              ? Math.min(3650, Math.max(1, Math.floor(input.presetValidDays)))
              : null,
          notes: input.notes?.trim() || null,
          createdByDiscordId: actor,
        },
      });
      codes.push(code);
    }
    await this.audit.log({
      action: AuditAction.LICENSE_KEY_GENERATED,
      entityType: 'license_key',
      entityId: 'batch',
      actorDiscordId: actor,
      actorKind: ActorKind.USER,
      metadata: { count: codes.length, planCode: input.planCode ?? null },
    });
    return { keys: codes };
  }

  async listKeys(principal: RequestPrincipal, opts?: { take?: number }) {
    this.assertAdmin(principal);
    const take = Math.min(200, Math.max(1, opts?.take ?? 100));
    const rows = await this.prisma.licenseKey.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        code: true,
        status: true,
        planCode: true,
        presetValidDays: true,
        notes: true,
        createdAt: true,
        createdByDiscordId: true,
        redeemedAt: true,
        redeemedGuildId: true,
        redeemedByDiscordId: true,
        revokedAt: true,
      },
    });
    return {
      items: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        redeemedAt: r.redeemedAt?.toISOString() ?? null,
        revokedAt: r.revokedAt?.toISOString() ?? null,
      })),
    };
  }

  async revokeKey(principal: RequestPrincipal, id: string) {
    const actor = this.assertAdmin(principal);
    const row = await this.prisma.licenseKey.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (row.status === LicenseKeyStatus.REDEEMED) {
      throw new BadRequestException('Cannot revoke redeemed key');
    }
    await this.prisma.licenseKey.update({
      where: { id },
      data: { status: LicenseKeyStatus.REVOKED, revokedAt: new Date() },
    });
    await this.audit.log({
      action: AuditAction.LICENSE_KEY_REVOKED,
      entityType: 'license_key',
      entityId: id,
      actorDiscordId: actor,
      actorKind: ActorKind.USER,
      metadata: { code: row.code },
    });
    return { ok: true as const };
  }

  async redeem(
    principal: RequestPrincipal,
    input: { code: string; guildId: string; manageableGuildIdsCsv: string },
  ) {
    const discordId = this.assertUserOrAdmin(principal);
    const allowed = parseManageableGuildIds(input.manageableGuildIdsCsv);
    if (!allowed.includes(input.guildId)) {
      throw new ForbiddenException('Guild not in your manageable list');
    }
    const code = normalizeLicenseCode(input.code);
    if (!/^sentra-[a-f0-9]{8,32}$/.test(code)) {
      throw new BadRequestException('Invalid license key format');
    }

    await this.prisma.$transaction(async (tx) => {
      const key = await tx.licenseKey.findUnique({
        where: { code },
      });
      if (!key || key.status !== LicenseKeyStatus.UNUSED) {
        throw new BadRequestException('Invalid or already used license key');
      }

      await tx.server.upsert({
        where: { guildId: input.guildId },
        create: { guildId: input.guildId },
        update: {},
      });

      const now = new Date();
      let validUntil: Date | null = null;
      if (key.presetValidDays != null && key.presetValidDays > 0) {
        validUntil = new Date(now);
        validUntil.setUTCDate(validUntil.getUTCDate() + key.presetValidDays);
      }

      await tx.guildEntitlement.upsert({
        where: { guildId: input.guildId },
        create: {
          guildId: input.guildId,
          status: LicenseStatus.ACTIVE,
          validFrom: now,
          validUntil,
          planCode: key.planCode,
          createdByDiscordId: discordId,
        },
        update: {
          status: LicenseStatus.ACTIVE,
          validFrom: now,
          validUntil,
          planCode: key.planCode ?? undefined,
          createdByDiscordId: discordId,
        },
      });

      await tx.licenseKey.update({
        where: { id: key.id },
        data: {
          status: LicenseKeyStatus.REDEEMED,
          redeemedAt: now,
          redeemedGuildId: input.guildId,
          redeemedByDiscordId: discordId,
        },
      });
    });

    await this.audit.log({
      action: AuditAction.LICENSE_KEY_REDEEMED,
      entityType: 'license_key',
      entityId: input.guildId,
      targetId: input.guildId,
      actorDiscordId: discordId,
      actorKind: ActorKind.USER,
      metadata: { code },
    });

    return { ok: true as const, guildId: input.guildId };
  }
}
