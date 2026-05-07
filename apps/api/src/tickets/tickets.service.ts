import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SupportTicketMessageAuthor, SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../events/outbox.service';
import { AuthzService } from '../auth/authz.service';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return 'image/png';
  }
  if (
    buf.length >= 6 &&
    (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')
  ) {
    return 'image/gif';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function normalizeLinks(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 4000);
}

function aggregateTicketBucketCounts(
  rows: { status: SupportTicketStatus; _count: number }[],
): { open: number; pending: number; closed: number } {
  const m = Object.fromEntries(rows.map((r) => [r.status, r._count])) as Record<
    string,
    number
  >;
  const n = (k: string) => m[k] ?? 0;
  return {
    open: n('OPEN') + n('NEEDS_EVIDENCE'),
    pending: n('EVIDENCE_SUBMITTED') + n('UNDER_REVIEW'),
    closed: n('RESOLVED') + n('REJECTED'),
  };
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
    private readonly authz: AuthzService,
  ) {}

  uploadDir(): string {
    const raw = this.config.get<string>('TICKET_UPLOAD_DIR')?.trim();
    return raw && raw.length > 0 ? raw : path.join(process.cwd(), 'data', 'ticket-uploads');
  }

  maxUploadBytes(): number {
    const n = Number(this.config.get('TICKET_UPLOAD_MAX_BYTES') ?? 5_000_000);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 20_000_000) : 5_000_000;
  }

  async ensureUploadDir(): Promise<void> {
    await fs.mkdir(this.uploadDir(), { recursive: true });
  }

  async createForPendingReport(
    tx: Prisma.TransactionClient,
    input: {
      reportId: string;
      guildId: string | null;
      reporterDiscordId: string;
    },
  ): Promise<void> {
    const ticketId = randomUUID();
    await tx.supportTicket.create({
      data: {
        id: ticketId,
        reportId: input.reportId,
        guildId: input.guildId,
        reporterDiscordId: input.reporterDiscordId,
        status: 'OPEN',
      },
    });
    await this.outbox.enqueue(tx, {
      type: 'support.ticket.created',
      idempotencyKey: `support.ticket.created:${ticketId}`,
      payload: {
        ticketId,
        reportId: input.reportId,
        reporterDiscordId: input.reporterDiscordId,
        guildId: input.guildId,
        status: 'OPEN',
      },
    });
  }

  async finalizeTicketForReport(
    tx: Prisma.TransactionClient,
    reportId: string,
    status: 'RESOLVED' | 'REJECTED',
    adminDiscordId: string,
  ): Promise<void> {
    const ticket = await tx.supportTicket.findUnique({ where: { reportId } });
    if (!ticket) return;
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status,
        assignedAdminDiscordId: adminDiscordId,
      },
    });
    await this.outbox.enqueue(tx, {
      type: 'support.ticket.resolved',
      idempotencyKey: `support.ticket.resolved:${ticket.id}:${status}:${reportId}`,
      payload: {
        ticketId: ticket.id,
        reportId,
        reporterDiscordId: ticket.reporterDiscordId,
        guildId: ticket.guildId,
        status,
      },
    });
  }

  assertTicketUser(principal: RequestPrincipal): string {
    if (principal.identity.kind !== 'user') {
      throw new ForbiddenException();
    }
    if (!this.authz.principalHasAnyRole(principal, [AppRole.USER, AppRole.ADMIN])) {
      throw new ForbiddenException('Tickets require User dashboard access');
    }
    return principal.identity.discordId;
  }

  async listMine(principal: RequestPrincipal) {
    const discordId = this.assertTicketUser(principal);
    const [rows, statusAgg] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { reporterDiscordId: discordId },
        orderBy: { createdAt: 'desc' },
        include: {
          report: {
            select: {
              id: true,
              status: true,
              reason: true,
              allegedFlagLevel: true,
              reportedUser: { select: { discordId: true } },
            },
          },
          attachments: {
            select: { id: true, mimeType: true, sizeBytes: true, createdAt: true },
          },
        },
      }),
      this.prisma.supportTicket.groupBy({
        by: ['status'],
        where: { reporterDiscordId: discordId },
        _count: true,
      }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        reportId: r.reportId,
        guildId: r.guildId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        evidenceLinks: r.evidenceLinks,
        adminNote: r.adminNote,
        userMessage: r.userMessage,
        targetDiscordId: r.report.reportedUser.discordId,
        reportStatus: r.report.status,
        reportReason: r.report.reason,
        allegedFlagLevel: r.report.allegedFlagLevel,
        attachments: r.attachments.map((a) => ({
          id: a.id,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          createdAt: a.createdAt.toISOString(),
        })),
      })),
      ticketBuckets: aggregateTicketBucketCounts(
        statusAgg.map((r) => ({ status: r.status, _count: r._count })),
      ),
    };
  }

  async getMine(principal: RequestPrincipal, ticketId: string) {
    const discordId = this.assertTicketUser(principal);
    const row = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, reporterDiscordId: discordId },
      include: {
        report: {
          select: {
            id: true,
            status: true,
            reason: true,
            allegedFlagLevel: true,
            reportedUser: { select: { discordId: true } },
          },
        },
        attachments: {
          select: { id: true, mimeType: true, sizeBytes: true, createdAt: true },
        },
      },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    return {
      id: row.id,
      status: row.status,
      reportId: row.reportId,
      guildId: row.guildId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      evidenceLinks: row.evidenceLinks,
      adminNote: row.adminNote,
      userMessage: row.userMessage,
      targetDiscordId: row.report.reportedUser.discordId,
      reportStatus: row.report.status,
      reportReason: row.report.reason,
      allegedFlagLevel: row.report.allegedFlagLevel,
      attachments: row.attachments.map((a) => ({
        id: a.id,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async getForAdmin(principal: RequestPrincipal, ticketId: string) {
    if (!this.authz.principalHasAnyRole(principal, [AppRole.ADMIN])) {
      throw new ForbiddenException();
    }
    const row = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId },
      include: {
        report: {
          select: {
            id: true,
            status: true,
            reason: true,
            allegedFlagLevel: true,
            reportedUser: { select: { discordId: true } },
          },
        },
        attachments: {
          select: { id: true, mimeType: true, sizeBytes: true, createdAt: true },
        },
      },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    return {
      id: row.id,
      status: row.status,
      reportId: row.reportId,
      guildId: row.guildId,
      reporterDiscordId: row.reporterDiscordId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      evidenceLinks: row.evidenceLinks,
      adminNote: row.adminNote,
      userMessage: row.userMessage,
      targetDiscordId: row.report.reportedUser.discordId,
      reportStatus: row.report.status,
      reportReason: row.report.reason,
      allegedFlagLevel: row.report.allegedFlagLevel,
      attachments: row.attachments.map((a) => ({
        id: a.id,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async submitEvidence(
    principal: RequestPrincipal,
    ticketId: string,
    linksRaw: unknown,
    files: Express.Multer.File[] | undefined,
  ) {
    const discordId = this.assertTicketUser(principal);
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, reporterDiscordId: discordId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status !== 'NEEDS_EVIDENCE') {
      throw new BadRequestException('Evidence is not requested for this ticket');
    }

    const links = normalizeLinks(linksRaw);
    const maxLinks = 20;
    if (links.length > maxLinks) {
      throw new BadRequestException(`At most ${maxLinks} links`);
    }

    const list = files ?? [];
    if (list.length === 0 && links.length === 0) {
      throw new BadRequestException('Provide at least one image or link');
    }

    const maxFiles = 8;
    if (list.length > maxFiles) {
      throw new BadRequestException(`At most ${maxFiles} images per request`);
    }

    const maxB = this.maxUploadBytes();
    for (const f of list) {
      if (f.size > maxB) {
        throw new BadRequestException(`Each image must be ≤ ${maxB} bytes`);
      }
      const buf = f.buffer;
      if (!buf?.length) {
        throw new BadRequestException('Empty upload');
      }
      const mime = sniffImageMime(buf);
      if (!mime) {
        throw new BadRequestException('Only JPEG, PNG, WebP, and GIF images are allowed');
      }
    }

    await this.ensureUploadDir();
    const baseDir = this.uploadDir();

    await this.prisma.$transaction(async (tx) => {
      const mergedLinks = [...links];
      for (const f of list) {
        const buf = f.buffer as Buffer;
        const mime = sniffImageMime(buf)!;
        const attId = randomUUID();
        const storageKey = `${ticket.id}/${attId}`;
        const abs = path.join(baseDir, ticket.id, attId);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, buf);
        await tx.supportTicketAttachment.create({
          data: {
            id: attId,
            ticketId: ticket.id,
            storageKey,
            mimeType: mime,
            sizeBytes: buf.length,
          },
        });
      }

      const prevLinks = Array.isArray(ticket.evidenceLinks)
        ? (ticket.evidenceLinks as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      const nextLinks = [...prevLinks, ...mergedLinks];

      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          evidenceLinks: nextLinks,
          status: 'EVIDENCE_SUBMITTED',
          userMessage: null,
        },
      });

      const attachmentCount = list.length;
      await this.outbox.enqueue(tx, {
        type: 'support.ticket.evidence_submitted',
        idempotencyKey: `support.ticket.evidence:${ticket.id}:${attachmentCount}:${nextLinks.length}`,
        payload: {
          ticketId: ticket.id,
          reportId: ticket.reportId,
          reporterDiscordId: ticket.reporterDiscordId,
          guildId: ticket.guildId,
          attachmentCount,
          linkCount: mergedLinks.length,
        },
      });
    });

    return { ok: true as const };
  }

  async adminList() {
    const [rows, statusAgg] = await Promise.all([
      this.prisma.supportTicket.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: {
          report: {
            select: {
              id: true,
              status: true,
              reason: true,
              allegedFlagLevel: true,
              reportedUser: { select: { discordId: true } },
            },
          },
        },
      }),
      this.prisma.supportTicket.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        reportId: r.reportId,
        guildId: r.guildId,
        reporterDiscordId: r.reporterDiscordId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        targetDiscordId: r.report.reportedUser.discordId,
        reportStatus: r.report.status,
        reportReason: r.report.reason,
        allegedFlagLevel: r.report.allegedFlagLevel,
        adminNote: r.adminNote,
      })),
      ticketBuckets: aggregateTicketBucketCounts(
        statusAgg.map((r) => ({ status: r.status, _count: r._count })),
      ),
    };
  }

  async adminPatch(
    ticketId: string,
    body: {
      status?: SupportTicketStatus;
      adminNote?: string | null;
      userMessage?: string | null;
    },
  ) {
    const existing = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!existing) throw new NotFoundException('Ticket not found');

    const data: Prisma.SupportTicketUpdateInput = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.adminNote !== undefined) data.adminNote = body.adminNote;
    if (body.userMessage !== undefined) data.userMessage = body.userMessage;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No changes');
    }

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data,
    });

    return { ok: true as const };
  }

  attachmentAbsolutePath(storageKey: string): string {
    const resolved = path.resolve(this.uploadDir(), storageKey);
    const base = path.resolve(this.uploadDir());
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new BadRequestException('Invalid storage key');
    }
    return resolved;
  }

  async getAttachmentForUser(
    principal: RequestPrincipal,
    ticketId: string,
    attachmentId: string,
  ): Promise<{ stream: ReturnType<typeof createReadStream>; mimeType: string }> {
    const uid = this.assertTicketUser(principal);
    const row = await this.prisma.supportTicketAttachment.findFirst({
      where: { id: attachmentId, ticketId },
      include: { ticket: true },
    });
    if (!row) throw new NotFoundException('Attachment not found');
    if (row.ticket.reporterDiscordId !== uid) {
      throw new ForbiddenException();
    }
    const abs = this.attachmentAbsolutePath(row.storageKey);
    const stream = createReadStream(abs);
    return { stream, mimeType: row.mimeType };
  }

  private assertTicketOpenForChat(ticket: { status: SupportTicketStatus }): void {
    if (ticket.status === 'RESOLVED' || ticket.status === 'REJECTED') {
      throw new BadRequestException('This ticket is closed');
    }
  }

  async listTicketMessages(
    principal: RequestPrincipal,
    ticketId: string,
    asAdmin: boolean,
  ) {
    if (asAdmin) {
      if (!this.authz.principalHasAnyRole(principal, [AppRole.ADMIN])) {
        throw new ForbiddenException();
      }
      const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw new NotFoundException('Ticket not found');
    } else {
      const discordId = this.assertTicketUser(principal);
      const ticket = await this.prisma.supportTicket.findFirst({
        where: { id: ticketId, reporterDiscordId: discordId },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
    }
    const messages = await this.prisma.supportTicketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: messages.map((m) => ({
        id: m.id,
        authorKind: m.authorKind,
        authorDiscordId: m.authorDiscordId,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async postTicketMessageFromUser(principal: RequestPrincipal, ticketId: string, body: string) {
    const discordId = this.assertTicketUser(principal);
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, reporterDiscordId: discordId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertTicketOpenForChat(ticket);
    const text = body.trim();
    if (text.length < 1 || text.length > 4000) {
      throw new BadRequestException('Message must be 1–4000 characters');
    }
    const row = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorKind: SupportTicketMessageAuthor.USER,
        authorDiscordId: discordId,
        body: text,
      },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });
    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }

  async postTicketMessageFromAdmin(principal: RequestPrincipal, ticketId: string, body: string) {
    if (!this.authz.principalHasAnyRole(principal, [AppRole.ADMIN])) {
      throw new ForbiddenException();
    }
    if (principal.identity.kind !== 'user') {
      throw new ForbiddenException();
    }
    const adminId = principal.identity.discordId;
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertTicketOpenForChat(ticket);
    const text = body.trim();
    if (text.length < 1 || text.length > 4000) {
      throw new BadRequestException('Message must be 1–4000 characters');
    }
    const row = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorKind: SupportTicketMessageAuthor.ADMIN,
        authorDiscordId: adminId,
        body: text,
      },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        updatedAt: new Date(),
        assignedAdminDiscordId: ticket.assignedAdminDiscordId ?? adminId,
      },
    });
    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }
}