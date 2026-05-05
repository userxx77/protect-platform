import { Module } from '@nestjs/common';
import { AdminGuildsController } from './admin-guilds.controller';
import { AdminGuildsService } from './admin-guilds.service';
import { AdminTicketsController } from './admin-tickets.controller';
import { AdminPlatformUsersController } from './admin-platform-users.controller';
import { AdminUserFlagsController } from './admin-user-flags.controller';
import { AdminFlagsService } from './admin-flags.service';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicModule } from '../platform-stats/public.module';
import { ReportsModule } from '../reports/reports.module';
import { TicketsModule } from '../tickets/tickets.module';
import { UsersModule } from '../users/users.module';
import { FlagPolicyService } from '../domain/flag-policy.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EntitlementsModule,
    AuditModule,
    EventsModule,
    PublicModule,
    TicketsModule,
    ReportsModule,
    UsersModule,
  ],
  controllers: [
    AdminGuildsController,
    AdminTicketsController,
    AdminPlatformUsersController,
    AdminUserFlagsController,
  ],
  providers: [AdminGuildsService, AdminFlagsService, FlagPolicyService],
  exports: [AdminGuildsService],
})
export class AdminModule {}
