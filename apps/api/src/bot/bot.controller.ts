import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { isDiscordPlatformAdmin } from '@protect/shared';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { ServersService } from '../servers/servers.service';
import { BotProxyServerConfigDto } from '../servers/dto/bot-proxy-server-config.dto';
import { BotGuildLifecycleDto, BotMembersBatchDto } from '../servers/dto/bot-guild.dto';
import { ActorKind } from '@prisma/client';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AdminGuildsService } from '../admin/admin-guilds.service';
import { UpsertEntitlementBodyDto } from '../admin/dto/admin-guilds.dto';
import { PlatformStatsService } from '../platform-stats/platform-stats.service';

@ApiTags('bot')
@Controller('bot')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@UseGuards(BotOrJwtGuard, RbacGuard)
export class BotController {
  constructor(
    private readonly servers: ServersService,
    private readonly entitlements: EntitlementsService,
    private readonly adminGuilds: AdminGuildsService,
    private readonly config: ConfigService,
    private readonly platformStats: PlatformStatsService,
  ) {}

  private assertBotActorAdmin(actorHeader: string | undefined): string {
    const actor = actorHeader?.trim();
    if (
      !actor ||
      !isDiscordPlatformAdmin(actor, this.config.get<string>('ADMIN_DISCORD_IDS'))
    ) {
      throw new ForbiddenException('admin_actor_required');
    }
    return actor;
  }

  @Get('guild/:guildId/summary')
  @RequireRoles(AppRole.BOT)
  async guildSummary(@Param('guildId') guildId: string) {
    const licensed = await this.entitlements.isGuildLicensed(guildId);
    return { guildId, licensed };
  }

  @Get('public-stats')
  @RequireRoles(AppRole.BOT)
  @ApiOkResponse({
    description: 'Aggregated counts for bot presence (no PII)',
  })
  async publicStats() {
    return this.platformStats.getPublicSnapshot();
  }

  @Post('stats/increment-check')
  @RequireRoles(AppRole.BOT)
  @ApiOkResponse({ description: 'Bump manual /check counter' })
  async incrementCheckCounter() {
    await this.platformStats.incrementManualChecks();
    return { ok: true as const };
  }

  @Post('admin/guilds/:guildId/entitlement')
  @RequireRoles(AppRole.BOT)
  @ApiHeader({ name: 'x-actor-discord-id', required: true })
  @ApiBody({ type: UpsertEntitlementBodyDto })
  async botUpsertEntitlement(
    @Param('guildId') guildId: string,
    @Body() body: UpsertEntitlementBodyDto,
    @Headers('x-actor-discord-id') actorHeader?: string,
  ) {
    const actor = this.assertBotActorAdmin(actorHeader);
    return this.adminGuilds.upsertEntitlement(guildId, body, actor);
  }

  @Post('admin/guilds/:guildId/sync-members')
  @RequireRoles(AppRole.BOT)
  @ApiHeader({ name: 'x-actor-discord-id', required: true })
  async botRequestMemberSync(
    @Param('guildId') guildId: string,
    @Headers('x-actor-discord-id') actorHeader?: string,
  ) {
    this.assertBotActorAdmin(actorHeader);
    return this.adminGuilds.requestMemberSync(guildId);
  }

  @Post('server/config')
  @RequireRoles(AppRole.BOT)
  @ApiBody({ type: BotProxyServerConfigDto })
  async proxyServerConfig(@Body() body: BotProxyServerConfigDto) {
    return this.servers.upsertConfig(
      { guildId: body.guildId, config: body.config },
      body.actorDiscordId,
      ActorKind.USER,
    );
  }

  @Post('guild/lifecycle')
  @RequireRoles(AppRole.BOT)
  @ApiBody({ type: BotGuildLifecycleDto })
  async guildLifecycle(@Body() body: BotGuildLifecycleDto) {
    await this.servers.recordBotGuildLifecycle(body);
    return { ok: true as const };
  }

  @Post('guild/:guildId/members/batch')
  @RequireRoles(AppRole.BOT)
  @ApiBody({ type: BotMembersBatchDto })
  async membersBatch(
    @Param('guildId') guildId: string,
    @Body() body: BotMembersBatchDto,
  ) {
    return this.servers.batchUpsertGuildMembers(guildId, body.members);
  }

  @Post('guild/:guildId/members/sync-done')
  @RequireRoles(AppRole.BOT)
  async membersSyncDone(@Param('guildId') guildId: string) {
    await this.servers.markMemberSyncIdle(guildId);
    return { ok: true as const };
  }
}
