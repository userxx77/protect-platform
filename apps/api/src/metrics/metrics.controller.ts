import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@SkipThrottle()
@Controller()
@UseGuards(BotOrJwtGuard, RbacGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @RequireRoles(AppRole.BOT, AppRole.ADMIN)
  getMetrics() {
    return this.metrics.snapshot();
  }
}
