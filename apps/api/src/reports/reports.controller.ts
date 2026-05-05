import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole } from '../auth/auth.types';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@ApiTags('reports')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller()
@UseGuards(BotOrJwtGuard, RbacGuard)
@RequireRoles(AppRole.BOT, AppRole.USER, AppRole.TRUSTED, AppRole.ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('report')
  async report(@Body() body: CreateReportDto) {
    return this.reports.create(body);
  }
}
