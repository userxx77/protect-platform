import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PlatformStatsService } from './platform-stats.service';
import { OpsStatsKeyGuard } from './ops-stats-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PublicController],
  providers: [PlatformStatsService, OpsStatsKeyGuard],
  exports: [PlatformStatsService],
})
export class PublicModule {}
