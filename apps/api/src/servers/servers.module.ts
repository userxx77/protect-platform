import { Module } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [AuditModule, EventsModule],
  controllers: [ServersController],
  providers: [ServersService],
})
export class ServersModule {}
