import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { RejectReportDto } from './dto/reject-report.dto';

@ApiTags('reports')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller()
@UseGuards(BotOrJwtGuard, RbacGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('report')
  @RequireRoles(AppRole.BOT, AppRole.USER, AppRole.TRUSTED, AppRole.ADMIN)
  async report(
    @Body() body: CreateReportDto,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    return this.reports.create(body, req.principal!);
  }

  @Get('reports/pending')
  @UseGuards(JwtAuthOnlyGuard)
  @RequireRoles(AppRole.ADMIN)
  async pending(@Query('limit') limit?: string) {
    return this.reports.listPending({ limit: Number(limit ?? 50) });
  }

  @Post('reports/:id/approve')
  @UseGuards(JwtAuthOnlyGuard)
  @RequireRoles(AppRole.ADMIN)
  async approve(
    @Param('id') id: string,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    const adminId =
      req.principal?.identity.kind === 'user'
        ? req.principal.identity.discordId
        : 'system';
    return this.reports.approve(id, adminId);
  }

  @Post('reports/:id/reject')
  @UseGuards(JwtAuthOnlyGuard)
  @RequireRoles(AppRole.ADMIN)
  async reject(
    @Param('id') id: string,
    @Body() body: RejectReportDto,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    const adminId =
      req.principal?.identity.kind === 'user'
        ? req.principal.identity.discordId
        : 'system';
    return this.reports.reject(id, adminId, body.note);
  }
}
