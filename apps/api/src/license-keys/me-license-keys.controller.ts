import { Body, Controller, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsString, Matches, MinLength } from 'class-validator';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { LicenseKeysService } from './license-keys.service';

class RedeemLicenseKeyDto {
  @IsString()
  @MinLength(8)
  code!: string;

  @IsString()
  @Matches(/^\d{17,20}$/)
  guildId!: string;
}

@ApiTags('me')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller()
@UseGuards(BotOrJwtGuard, RbacGuard)
export class MeLicenseKeysController {
  constructor(private readonly licenseKeys: LicenseKeysService) {}

  @Post('me/license-keys/redeem')
  @RequireRoles(AppRole.USER, AppRole.ADMIN)
  redeem(
    @Body() body: RedeemLicenseKeyDto,
    @Query('manageable') manageable: string,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    return this.licenseKeys.redeem(req.principal!, {
      code: body.code,
      guildId: body.guildId,
      manageableGuildIdsCsv: manageable ?? '',
    });
  }
}
