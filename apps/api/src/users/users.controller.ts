import { Controller, ForbiddenException, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { FlagLevel } from '@prisma/client';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller()
@UseGuards(BotOrJwtGuard, RbacGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('user/:id')
  @RequireRoles(AppRole.BOT, AppRole.USER, AppRole.TRUSTED, AppRole.ADMIN)
  async getUser(
    @Param('id') id: string,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    const raw = req.headers['x-protect-skip-user-cache'];
    const wantSkip =
      raw === 'true' ||
      raw === '1' ||
      (Array.isArray(raw) && raw.some((v) => v === 'true' || v === '1'));
    if (wantSkip && req.principal?.identity.kind !== 'bot') {
      throw new ForbiddenException(
        'x-protect-skip-user-cache is only allowed for bot API key requests',
      );
    }
    return this.users.getPublicByDiscordId(id, { skipCache: wantSkip });
  }

  @Get('users/flagged')
  @RequireRoles(AppRole.ADMIN)
  @ApiQuery({ name: 'level', required: false, enum: FlagLevel })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async flagged(
    @Query('level') levelRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw ?? 20) || 20, 1), 100);
    const level =
      levelRaw && Object.values(FlagLevel).includes(levelRaw as FlagLevel)
        ? (levelRaw as FlagLevel)
        : undefined;
    return this.users.listFlagged({ level, cursor, limit });
  }
}
