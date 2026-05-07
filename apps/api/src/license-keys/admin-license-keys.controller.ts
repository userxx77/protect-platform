import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { LicenseKeysService } from './license-keys.service';

class GenerateLicenseKeysBodyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  count!: number;

  @IsOptional()
  @IsString()
  planCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  presetValidDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthOnlyGuard, RbacGuard)
@RequireRoles(AppRole.ADMIN)
export class AdminLicenseKeysController {
  constructor(private readonly licenseKeys: LicenseKeysService) {}

  @Post('admin/license-keys/generate')
  generate(
    @Body() body: GenerateLicenseKeysBodyDto,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    return this.licenseKeys.generateKeys(req.principal!, {
      count: body.count,
      planCode: body.planCode,
      presetValidDays: body.presetValidDays,
      notes: body.notes,
    });
  }

  @Get('admin/license-keys')
  list(@Req() req: Request & { principal?: RequestPrincipal }) {
    return this.licenseKeys.listKeys(req.principal!);
  }

  @Post('admin/license-keys/:id/revoke')
  revoke(
    @Param('id') id: string,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    return this.licenseKeys.revokeKey(req.principal!, id);
  }
}
