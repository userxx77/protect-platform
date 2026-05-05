import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BotOrJwtGuard } from '../auth/bot-or-jwt.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { TicketsService } from './tickets.service';

@ApiTags('me')
@ApiBearerAuth()
@ApiSecurity('apiKey')
@Controller()
@UseGuards(BotOrJwtGuard, RbacGuard)
export class MeTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('me/tickets')
  @RequireRoles(AppRole.USER, AppRole.ADMIN)
  list(@Req() req: Request & { principal?: RequestPrincipal }) {
    return this.tickets.listMine(req.principal!);
  }

  @Get('me/tickets/:id')
  @RequireRoles(AppRole.USER, AppRole.ADMIN)
  getOne(
    @Param('id') id: string,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    return this.tickets.getMine(req.principal!, id);
  }

  @Post('me/tickets/:id/evidence')
  @RequireRoles(AppRole.USER, AppRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        links: {
          type: 'string',
          description: 'JSON array of URL strings, e.g. ["https://…"]',
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', 8, {
      storage: memoryStorage(),
      limits: { fileSize: 20_000_000 },
    }),
  )
  submitEvidence(
    @Param('id') id: string,
    @Req() req: Request & { principal?: RequestPrincipal },
    @UploadedFiles() images: Express.Multer.File[] | undefined,
  ) {
    const body = req.body as { links?: string };
    let linksParsed: unknown;
    if (body.links?.trim()) {
      try {
        linksParsed = JSON.parse(body.links) as unknown;
      } catch {
        linksParsed = [];
      }
    }
    return this.tickets.submitEvidence(req.principal!, id, linksParsed, images);
  }

  @Get('me/tickets/:id/attachments/:attachmentId')
  @RequireRoles(AppRole.USER, AppRole.ADMIN)
  async attachment(
    @Param('id') ticketId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: Request & { principal?: RequestPrincipal },
  ) {
    const { stream, mimeType } = await this.tickets.getAttachmentForUser(
      req.principal!,
      ticketId,
      attachmentId,
    );
    return new StreamableFile(stream, { type: mimeType });
  }
}
