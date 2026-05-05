import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PlatformStatsService } from './platform-stats.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PublicController],
  providers: [PlatformStatsService],
  exports: [PlatformStatsService],
})
export class PublicModule {}
