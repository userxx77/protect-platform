import { Module } from '@nestjs/common';
import { FlagsController } from './flags.controller';
import { FlagsService } from './flags.service';
import { FlagPolicyService } from '../domain/flag-policy.service';
import { FlagDecayService } from '../domain/flag-decay.service';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [UsersModule, AuditModule, EventsModule],
  controllers: [FlagsController],
  providers: [FlagsService, FlagPolicyService, FlagDecayService],
})
export class FlagsModule {}
