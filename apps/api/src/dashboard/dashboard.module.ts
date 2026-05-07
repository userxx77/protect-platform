import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicModule } from '../platform-stats/public.module';
import { TicketsModule } from '../tickets/tickets.module';
import { UsersModule } from '../users/users.module';
import { ReportsModule } from '../reports/reports.module';
import { DashboardService } from './dashboard.service';
import { MeDashboardController } from './me-dashboard.controller';
import { AdminDashboardController } from './admin-dashboard.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    PublicModule,
    TicketsModule,
    UsersModule,
    ReportsModule,
  ],
  controllers: [MeDashboardController, AdminDashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
