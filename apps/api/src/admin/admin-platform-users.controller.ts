import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActorKind, AuditAction, PlatformRole } from '@prisma/client';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPlatformRoleBodyDto } from './dto/admin-platform-role.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/platform-users')
@UseGuards(BotOrJwtGuard, JwtAuthOnlyGuard, RbacGuard)
@RequireRoles(AppRole.ADMIN)
export class AdminPlatformUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Patch(':discordId/role')
  async patchRole(
    @Param('discordId') discordId: string,
    @Body() body: AdminPlatformRoleBodyDto,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    const role =
      body.role === 'USER' ? PlatformRole.USER : PlatformRole.CHECKER;
    const row = await this.prisma.platformAccount.upsert({
      where: { discordUserId: discordId },
      create: { discordUserId: discordId, role },
      update: { role },
    });
    const actor =
      req.principal?.identity.kind === 'user' ? req.principal.identity.discordId : null;
    await this.audit.log({
      action: AuditAction.ROLE_ASSIGNED,
      entityType: 'platform_account',
      entityId: row.id,
      targetId: discordId,
      actorDiscordId: actor,
      actorKind: ActorKind.USER,
      metadata: { platformRole: role },
    });
    return { discordUserId: discordId, role: row.role };
  }
}
