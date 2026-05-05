import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { FlagsService } from './flags.service';
import { CreateFlagDto } from './dto/create-flag.dto';

@ApiTags('flags')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller()
@UseGuards(BotOrJwtGuard, RbacGuard)
@RequireRoles(AppRole.BOT, AppRole.TRUSTED, AppRole.ADMIN)
export class FlagsController {
  constructor(private readonly flags: FlagsService) {}

  @Post('flag')
  async flag(@Body() body: CreateFlagDto, @Req() req: Request) {
    const principal = req.principal!;
    return this.flags.createFlag(body, principal);
  }
}
