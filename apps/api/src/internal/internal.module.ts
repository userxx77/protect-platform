import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FlagPolicyService } from '../domain/flag-policy.service';
import { UsersModule } from '../users/users.module';
import { InternalController } from './internal.controller';
import { InternalOpsService } from './internal-ops.service';
import { UserConsistencyService } from './user-consistency.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [AuthModule, MetricsModule, UsersModule],
  controllers: [InternalController],
  providers: [InternalOpsService, UserConsistencyService, FlagPolicyService],
})
export class InternalModule {}
