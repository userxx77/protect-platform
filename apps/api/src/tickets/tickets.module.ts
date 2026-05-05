import { Module } from '@nestjs/common';
import { MeTicketsController } from './me-tickets.controller';
import { TicketsService } from './tickets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule],
  controllers: [MeTicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
