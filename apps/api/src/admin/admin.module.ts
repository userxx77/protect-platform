import { Module } from '@nestjs/common';
import { AdminGuildsController } from './admin-guilds.controller';
import { AdminGuildsService } from './admin-guilds.service';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EntitlementsModule,
    AuditModule,
    EventsModule,
  ],
  controllers: [AdminGuildsController],
  providers: [AdminGuildsService],
  exports: [AdminGuildsService],
})
export class AdminModule {}
