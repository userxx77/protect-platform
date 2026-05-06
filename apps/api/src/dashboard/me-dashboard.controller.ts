import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthOnlyGuard, RbacGuard)
export class MeDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('me/dashboard')
  @RequireRoles(AppRole.USER, AppRole.CHECKER, AppRole.TRUSTED, AppRole.ADMIN)
  getMeDashboard(@Req() req: Request & { principal?: RequestPrincipal }) {
    return this.dashboard.getMeDashboard(req.principal!);
  }
}
