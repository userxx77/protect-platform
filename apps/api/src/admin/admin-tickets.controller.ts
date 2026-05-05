import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';
import type { Request } from 'express';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { AdminPatchTicketDto } from '../tickets/dto/admin-patch-ticket.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { TicketsService } from '../tickets/tickets.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/tickets')
@UseGuards(BotOrJwtGuard, JwtAuthOnlyGuard, RbacGuard)
@RequireRoles(AppRole.ADMIN)
export class AdminTicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list() {
    return this.tickets.adminList();
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: AdminPatchTicketDto) {
    return this.tickets.adminPatch(id, body);
  }

  @Post(':id/resolve')
  async resolve(
    @Param('id') ticketId: string,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { report: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Report is not pending');
    }
    const adminId =
      req.principal?.identity.kind === 'user'
        ? req.principal.identity.discordId
        : 'system';
    return this.reports.approve(ticket.reportId, adminId);
  }
}
