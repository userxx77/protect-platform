import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { isDiscordPlatformAdmin, parseAdminDiscordIds } from '@protect/shared';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { ServersService } from '../servers/servers.service';
import { BotProxyServerConfigDto } from '../servers/dto/bot-proxy-server-config.dto';
import { BotGuildLifecycleDto, BotGuildElevationScanDto, BotMembersBatchDto } from '../servers/dto/bot-guild.dto';
import { ActorKind, PlatformRole } from '@prisma/client';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AdminGuildsService } from '../admin/admin-guilds.service';
import { UpsertEntitlementBodyDto } from '../admin/dto/admin-guilds.dto';
import { PlatformStatsService } from '../platform-stats/platform-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminFlagsService } from '../admin/admin-flags.service';
import { ReportsService } from '../reports/reports.service';
import { RejectReportDto } from '../reports/dto/reject-report.dto';
import { ApproveReportDto } from '../reports/dto/approve-report.dto';

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
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly adminFlags: AdminFlagsService,
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
    const [licensed, blacklisted] = await Promise.all([
      this.entitlements.isGuildLicensed(guildId),
      this.servers.isGuildBlacklisted(guildId),
    ]);
    return { guildId, licensed, blacklisted };
  }

  @Get('discord/:discordId/capabilities')
  @RequireRoles(AppRole.BOT)
  @ApiOkResponse({
    description: 'Platform role and whether the user may file community (pending) reports',
  })
  async discordCapabilities(@Param('discordId') discordId: string) {
    const [account, trusted] = await Promise.all([
      this.prisma.platformAccount.findUnique({
        where: { discordUserId: discordId },
        select: { role: true },
      }),
      this.prisma.trustedUser.findUnique({
        where: { discordUserId: discordId },
        select: { discordUserId: true },
      }),
    ]);
    const legacy = parseAdminDiscordIds(this.config.get<string>('ADMIN_DISCORD_IDS'));
    const platformRole = account?.role ?? PlatformRole.CHECKER;
    const canSubmitCommunityReport =
      trusted != null ||
      legacy.includes(discordId) ||
      account?.role === PlatformRole.USER ||
      account?.role === PlatformRole.ADMIN;
    return { platformRole, canSubmitCommunityReport };
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

  @Get('reports/mine')
  @RequireRoles(AppRole.BOT)
  @ApiHeader({ name: 'x-actor-discord-id', required: true })
  async botReportsMine(
    @Headers('x-actor-discord-id') actorHeader: string | undefined,
    @Query('limit') limitRaw?: string,
  ) {
    const actor = actorHeader?.trim();
    if (!actor) throw new BadRequestException('actor_required');
    return this.reports.listMineForReporter(actor, Number(limitRaw ?? 15));
  }

  @Get('reports/pending')
  @RequireRoles(AppRole.BOT)
  @ApiHeader({ name: 'x-actor-discord-id', required: true })
  async botReportsPending(
    @Headers('x-actor-discord-id') actorHeader: string | undefined,
    @Query('limit') limitRaw?: string,
  ) {
    this.assertBotActorAdmin(actorHeader);
    return this.reports.listPending({ limit: Number(limitRaw ?? 25) });
  }

  @Get('reports/:id')
  @RequireRoles(AppRole.BOT)
  @ApiHeader({ name: 'x-actor-discord-id', required: true })
  async botReportGetOne(
    @Param('id') id: string,
    @Headers('x-actor-discord-id') actorHeader: string | undefined,
  ) {
    const actor = actorHeader?.trim();
    if (!actor) throw new BadRequestException('actor_required');
    return this.reports.getForBotViewer(id, actor);
  }

  @Post('reports/:id/approve')
  @RequireRoles(AppRole.BOT)
  @ApiHeader({ name: 'x-actor-discord-id', required: true })
  async botReportApprove(
    @Param('id') id: string,
    @Body() body: ApproveReportDto,
    @Headers('x-actor-discord-id') actorHeader: string | undefined,
  ) {
    const actor = this.assertBotActorAdmin(actorHeader);
    return this.reports.approve(id, actor, body.severity);
  }

  @Post('reports/:id/reject')
  @RequireRoles(AppRole.BOT)
  @ApiHeader({ name: 'x-actor-discord-id', required: true })
  async botReportReject(
    @Param('id') id: string,
    @Body() body: RejectReportDto,
    @Headers('x-actor-discord-id') actorHeader: string | undefined,
  ) {
    const actor = this.assertBotActorAdmin(actorHeader);
    return this.reports.reject(id, actor, body.note);
  }

  @Delete('admin/users/:discordId/flags/:flagId')
  @RequireRoles(AppRole.BOT)
  @ApiHeader({ name: 'x-actor-discord-id', required: true })
  async botAdminUnflag(
    @Param('discordId') targetDiscordId: string,
    @Param('flagId') flagId: string,
    @Headers('x-actor-discord-id') actorHeader: string | undefined,
  ) {
    const actor = this.assertBotActorAdmin(actorHeader);
    return this.adminFlags.deleteFlag(actor, targetDiscordId, flagId);
  }

  @Post('admin/guilds/:guildId/blacklist')
  @RequireRoles(AppRole.BOT)
  @ApiHeader({ name: 'x-actor-discord-id', required: true })
  async botBlacklistGuild(
    @Param('guildId') guildId: string,
    @Body() body: { reason?: string },
    @Headers('x-actor-discord-id') actorHeader: string | undefined,
  ) {
    const actor = this.assertBotActorAdmin(actorHeader);
    await this.servers.addGuildBlacklist(guildId, actor, body?.reason);
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

  @Post('guild/:guildId/members/elevation-scan')
  @RequireRoles(AppRole.BOT)
  @ApiBody({ type: BotGuildElevationScanDto })
  async membersElevationScan(
    @Param('guildId') guildId: string,
    @Body() body: BotGuildElevationScanDto,
  ) {
    void guildId;
    return {
      hits: await this.servers.scanDiscordIdsAgainstAlertThreshold(
        body.discordIds,
        body.alertMinLevel,
      ),
    };
  }

  @Post('guild/:guildId/members/sync-done')
  @RequireRoles(AppRole.BOT)
  async membersSyncDone(@Param('guildId') guildId: string) {
    await this.servers.markMemberSyncIdle(guildId);
    return { ok: true as const };
  }
}
