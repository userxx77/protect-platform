import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { InternalOpsService } from './internal-ops.service';
import { UserConsistencyService } from './user-consistency.service';
import { MetricsService } from '../metrics/metrics.service';

@ApiTags('internal')
@ApiBearerAuth()
@SkipThrottle()
@Controller()
@UseGuards(JwtAuthOnlyGuard, RbacGuard)
@RequireRoles(AppRole.ADMIN)
export class InternalController {
  constructor(
    private readonly ops: InternalOpsService,
    private readonly metrics: MetricsService,
    private readonly userConsistency: UserConsistencyService,
  ) {}

  @Get('internal/events/:id')
  async eventTrace(@Param('id') id: string) {
    return this.ops.getOutboxEventTrace(id);
  }

  @Get('internal/outbox/backlog')
  async outboxBacklog() {
    return this.ops.getOutboxBacklog();
  }

  @Get('internal/worker/status')
  async workerStatus() {
    return this.ops.getWorkerStatus();
  }

  @Get('internal/ops/overview')
  async opsOverview() {
    return this.ops.getOpsOverview();
  }

  @Get('internal/ops/debug')
  async opsDebug() {
    return this.ops.getOpsDebug();
  }

  @Get('internal/metrics/summary')
  async metricsSummary() {
    return this.metrics.detailedSnapshot();
  }

  @Get('internal/cache/user/:discordId/validate')
  async validateUserCache(@Param('discordId') discordId: string) {
    return this.userConsistency.validate(discordId);
  }

  @Post('internal/cache/user/:discordId/repair')
  async repairUserCache(@Param('discordId') discordId: string) {
    return this.userConsistency.repair(discordId);
  }
}
