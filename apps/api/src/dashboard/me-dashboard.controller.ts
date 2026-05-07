import { Controller, Get, MessageEvent, Sse, Req, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthOnlyGuard } from '../auth/jwt-admin.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthOnlyGuard, RbacGuard)
export class MeDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('me/dashboard')
  @RequireRoles(AppRole.USER, AppRole.CHECKER, AppRole.TRUSTED, AppRole.ADMIN)
  getMeDashboard(@Req() req: Request & { principal?: RequestPrincipal }) {
    return this.dashboard.getMeDashboard(req.principal!);
  }

  @Sse('me/dashboard/activity-stream')
  @RequireRoles(AppRole.USER, AppRole.CHECKER, AppRole.TRUSTED, AppRole.ADMIN)
  activityStream(): Observable<MessageEvent> {
    let watermark = new Date(Date.now() - 5_000);
    return new Observable<MessageEvent>((observer) => {
      const iv = setInterval(() => {
        void this.dashboard
          .pollAuditSince(watermark)
          .then(({ items, watermark: next }) => {
            watermark = next;
            for (const it of items) {
              observer.next({ data: JSON.stringify(it) } as MessageEvent);
            }
          })
          .catch((err: unknown) => observer.error(err));
      }, 3000);
      return () => clearInterval(iv);
    });
  }
}
