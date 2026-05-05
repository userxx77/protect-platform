import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthzService } from './authz.service';
import { BotOrJwtGuard } from './bot-or-jwt.guard';
import { RbacGuard } from './rbac.guard';
import { JwtAuthOnlyGuard } from './jwt-admin.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('DASHBOARD_JWT_SECRET') ?? 'dev-secret-change-me',
      }),
    }),
  ],
  providers: [AuthzService, BotOrJwtGuard, RbacGuard, JwtAuthOnlyGuard],
  exports: [JwtModule, AuthzService, BotOrJwtGuard, RbacGuard, JwtAuthOnlyGuard],
})
export class AuthModule {}
