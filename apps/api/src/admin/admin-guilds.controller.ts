import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { AdminGuildsService } from './admin-guilds.service';
import { UpsertEntitlementBodyDto } from './dto/admin-guilds.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthOnlyGuard, RbacGuard)
@RequireRoles(AppRole.ADMIN)
export class AdminGuildsController {
  constructor(private readonly adminGuilds: AdminGuildsService) {}

  @Get('admin/guilds')
  list() {
    return this.adminGuilds.listGuilds();
  }

  @Post('admin/guilds/:guildId/entitlement')
  upsertEntitlement(
    @Param('guildId') guildId: string,
    @Body() body: UpsertEntitlementBodyDto,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    const actor =
      req.principal?.identity.kind === 'user'
        ? req.principal.identity.discordId
        : 'system';
    return this.adminGuilds.upsertEntitlement(guildId, body, actor);
  }

  @Post('admin/guilds/:guildId/sync-members')
  requestSync(@Param('guildId') guildId: string) {
    return this.adminGuilds.requestMemberSync(guildId);
  }
}
