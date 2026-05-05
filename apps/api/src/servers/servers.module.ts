import { Module } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [AuditModule, EventsModule, EntitlementsModule],
  controllers: [ServersController],
  providers: [ServersService],
  exports: [ServersService],
})
export class ServersModule {}
