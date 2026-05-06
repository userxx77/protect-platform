import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthOnlyGuard, RbacGuard)
export class AdminDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('admin/dashboard')
  @RequireRoles(AppRole.ADMIN)
  getAdminDashboard() {
    return this.dashboard.getAdminDashboard();
  }

  @Get('admin/analytics/overview')
  @RequireRoles(AppRole.ADMIN)
  getAnalytics(@Query('range') rangeRaw?: string) {
    const range =
      rangeRaw === '7d' || rangeRaw === '30d' || rangeRaw === '24h'
        ? rangeRaw
        : '24h';
    return this.dashboard.getAdminAnalytics(range);
  }
}
