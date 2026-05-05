import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { MeService } from './me.service';
import { MeGuildsResolveDto } from './dto/me-guilds.dto';

@ApiTags('me')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller()
@UseGuards(BotOrJwtGuard, RbacGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Post('me/guilds/resolve')
  @RequireRoles(AppRole.USER, AppRole.TRUSTED, AppRole.ADMIN)
  resolve(@Body() body: MeGuildsResolveDto) {
    return this.me.resolveGuilds(body.guildIds);
  }

  @Get('me/guilds/:guildId/members')
  @RequireRoles(AppRole.USER, AppRole.TRUSTED, AppRole.ADMIN)
  members(
    @Param('guildId') guildId: string,
    @Query('manageable') manageable: string,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    return this.me.listGuildMembers(
      guildId,
      req.principal!,
      manageable ?? '',
    );
  }
}
