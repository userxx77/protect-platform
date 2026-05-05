import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PlatformStatsService } from './platform-stats.service';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly stats: PlatformStatsService) {}

  @Get('platform-stats')
  @SkipThrottle()
  @ApiOkResponse({
    description: 'Aggregated platform metrics (no auth)',
  })
  platformStats() {
    return this.stats.getPublicSnapshot();
  }
}
