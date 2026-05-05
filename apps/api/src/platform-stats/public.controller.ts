import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PlatformStatsService } from './platform-stats.service';
import { OpsStatsKeyGuard } from './ops-stats-key.guard';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly stats: PlatformStatsService) {}

  @Get('platform-stats')
  @UseGuards(OpsStatsKeyGuard)
  @SkipThrottle()
  @ApiOkResponse({
    description: 'Aggregated platform metrics (requires SENTRA_OPS_STATS_KEY)',
  })
  platformStats() {
    return this.stats.getPublicSnapshot();
  }
}
