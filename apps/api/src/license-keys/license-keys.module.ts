import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { LicenseKeysService } from './license-keys.service';
import { AdminLicenseKeysController } from './admin-license-keys.controller';
import { MeLicenseKeysController } from './me-license-keys.controller';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [AdminLicenseKeysController, MeLicenseKeysController],
  providers: [LicenseKeysService],
  exports: [LicenseKeysService],
})
export class LicenseKeysModule {}
