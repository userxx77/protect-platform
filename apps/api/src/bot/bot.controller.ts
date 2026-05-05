import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { ServersService } from '../servers/servers.service';
import { BotProxyServerConfigDto } from '../servers/dto/bot-proxy-server-config.dto';
import { BotGuildLifecycleDto, BotMembersBatchDto } from '../servers/dto/bot-guild.dto';
import { ActorKind } from '@prisma/client';
import { EntitlementsService } from '../entitlements/entitlements.service';

@ApiTags('bot')
@Controller('bot')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@UseGuards(BotOrJwtGuard, RbacGuard)
export class BotController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servers: ServersService,
    private readonly entitlements: EntitlementsService,
  ) {}

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
    const [usersTracked, serversActive] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.server.count(),
    ]);
    return {
      usersTracked,
      serversActive,
      capturedAt: new Date().toISOString(),
    };
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
    return this.servers.batchUpsertGuildMembers(guildId, body.discordUserIds);
  }

  @Post('guild/:guildId/members/sync-done')
  @RequireRoles(AppRole.BOT)
  async membersSyncDone(@Param('guildId') guildId: string) {
    await this.servers.markMemberSyncIdle(guildId);
    return { ok: true as const };
  }
}
