import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
import { ActorKind } from '@prisma/client';

@ApiTags('bot')
@Controller('bot')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@UseGuards(BotOrJwtGuard, RbacGuard)
export class BotController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servers: ServersService,
  ) {}

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
}
