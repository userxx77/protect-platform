import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsAntiAbuseService } from './reports-anti-abuse.service';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { FlagPolicyService } from '../domain/flag-policy.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [UsersModule, AuditModule, EventsModule, EntitlementsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsAntiAbuseService, FlagPolicyService],
})
export class ReportsModule {}
