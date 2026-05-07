import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ServersModule } from '../servers/servers.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AdminModule } from '../admin/admin.module';
import { PublicModule } from '../platform-stats/public.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ServersModule,
    EntitlementsModule,
    AdminModule,
    PublicModule,
    ReportsModule,
  ],
  controllers: [BotController],
})
export class BotModule {}
