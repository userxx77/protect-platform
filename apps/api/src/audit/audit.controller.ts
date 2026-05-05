import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller('audit')
@UseGuards(BotOrJwtGuard, RbacGuard)
@RequireRoles(AppRole.ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction })
  @ApiQuery({ name: 'actorDiscordId', required: false })
  @ApiQuery({ name: 'targetId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  async list(
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('action') actionRaw?: string,
    @Query('actorDiscordId') actorDiscordId?: string,
    @Query('targetId') targetId?: string,
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
  ) {
    const limit = Math.min(Number(limitRaw ?? 50) || 50, 200);
    const action =
      actionRaw && Object.values(AuditAction).includes(actionRaw as AuditAction)
        ? (actionRaw as AuditAction)
        : undefined;
    return this.audit.list({
      limit,
      cursor,
      action,
      actorDiscordId,
      targetId,
      from: fromRaw ? new Date(fromRaw) : undefined,
      to: toRaw ? new Date(toRaw) : undefined,
    });
  }
}
