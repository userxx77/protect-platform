import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { AdminFlagsService } from './admin-flags.service';
import { AdminPatchFlagDto } from './dto/admin-patch-flag.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(BotOrJwtGuard, JwtAuthOnlyGuard, RbacGuard)
@RequireRoles(AppRole.ADMIN)
export class AdminUserFlagsController {
  constructor(private readonly adminFlags: AdminFlagsService) {}

  @Get(':discordId/flags')
  list(@Param('discordId') discordId: string) {
    return this.adminFlags.listForUser(discordId);
  }

  @Delete(':discordId/flags/:flagId')
  remove(
    @Param('discordId') discordId: string,
    @Param('flagId') flagId: string,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    const actor =
      req.principal?.identity.kind === 'user' ? req.principal.identity.discordId : 'system';
    return this.adminFlags.deleteFlag(actor, discordId, flagId);
  }

  @Patch(':discordId/flags/:flagId')
  patch(
    @Param('discordId') discordId: string,
    @Param('flagId') flagId: string,
    @Body() body: AdminPatchFlagDto,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    if (body.reason === undefined && body.weight === undefined) {
      throw new BadRequestException('No changes');
    }
    const actor =
      req.principal?.identity.kind === 'user' ? req.principal.identity.discordId : 'system';
    return this.adminFlags.patchFlag(actor, discordId, flagId, body);
  }
}
