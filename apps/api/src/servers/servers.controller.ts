import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ActorKind } from '@prisma/client';
import type { Request } from 'express';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { ServersService } from './servers.service';
import { UpsertServerConfigDto } from './dto/server-config.dto';

@ApiTags('servers')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller()
@UseGuards(BotOrJwtGuard, RbacGuard)
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Get('servers')
  @RequireRoles(AppRole.ADMIN)
  async listServers() {
    return this.servers.listSummaries();
  }

  @Get('server/:id')
  @RequireRoles(AppRole.BOT, AppRole.USER, AppRole.TRUSTED, AppRole.ADMIN)
  async getServer(@Param('id') id: string) {
    return this.servers.getByGuildId(id);
  }

  @Post('server/config')
  @RequireRoles(AppRole.ADMIN)
  async postConfig(@Body() body: UpsertServerConfigDto, @Req() req: Request) {
    const principal = req.principal!;
    const actorKind =
      principal.identity.kind === 'bot' ? ActorKind.BOT : ActorKind.USER;
    const actorDiscordId =
      principal.identity.kind === 'user'
        ? principal.identity.discordId
        : 'bot-service';
    return this.servers.upsertConfig(body, actorDiscordId, actorKind);
  }
}
