import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';

@ApiTags('integrations')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller('integrations')
@UseGuards(BotOrJwtGuard, RbacGuard)
export class IntegrationsController {
  @Get('status')
  @RequireRoles(AppRole.BOT, AppRole.ADMIN)
  status() {
    return {
      ok: true,
      message:
        'Integrations API reserved for authenticated clients (bot API key or dashboard JWT).',
    };
  }
}
