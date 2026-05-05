import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserCacheService } from '../cache/user-cache.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  controllers: [UsersController],
  providers: [UsersService, UserCacheService],
  exports: [UsersService, UserCacheService],
})
export class UsersModule {}
