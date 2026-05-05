import { Module } from '@nestjs/common';
import { AdminGuildsController } from './admin-guilds.controller';
import { AdminGuildsService } from './admin-guilds.service';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicModule } from '../platform-stats/public.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EntitlementsModule,
    AuditModule,
    EventsModule,
    PublicModule,
  ],
  controllers: [AdminGuildsController],
  providers: [AdminGuildsService],
  exports: [AdminGuildsService],
})
export class AdminModule {}
