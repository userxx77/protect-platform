import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ServersModule } from '../servers/servers.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [PrismaModule, AuthModule, ServersModule, EntitlementsModule],
  controllers: [BotController],
})
export class BotModule {}
