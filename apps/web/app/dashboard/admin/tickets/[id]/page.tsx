import Link from 'next/link';
import { dashboardApi } from '@/lib/api-server';
import { FlagLevelBadge } from '@/components/flag-level-badge';
import { TicketThreadClient, type TicketMessageItem } from '@/app/dashboard/tickets/ticket-thread-client';
import { Button } from '@/components/ui/button';
import { patchTicketAction, resolveTicketAction } from '../actions';
import { flagActionLevels, flagLevelDisplayName, type FlagActionLevel } from '@protect/shared';

type AdminTicketDetail = {
  id: string;
  status: string;
  reportId: string;
  guildId: string | null;
  reporterDiscordId: string;
  createdAt: string;
  updatedAt: string;
  evidenceLinks: unknown;
  adminNote: string | null;
  userMessage: string | null;
  targetDiscordId: string;
  reportStatus: string;
  reportReason: string;
  allegedFlagLevel?: string | null;
  attachments: Array<{
    id: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
};

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let t: AdminTicketDetail;
  let initialMessages: TicketMessageItem[];
  try {
    t = await dashboardApi<AdminTicketDetail>(`/admin/tickets/${id}`);
    const msgRes = await dashboardApi<{ items: TicketMessageItem[] }>(
      `/admin/tickets/${id}/messages`,
    );
    initialMessages = Array.isArray(msgRes.items) ? msgRes.items : [];
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Ticket</h1>
        <p className="text-muted-foreground mt-2">{e instanceof Error ? e.message : 'Not found'}</p>
        <Button variant="ghost" className="mt-4" asChild>
          <Link href="/dashboard/admin/tickets">Back to tickets</Link>
        </Button>
      </div>
    );
  }

  const links = Array.isArray(t.evidenceLinks)
    ? (t.evidenceLinks as string[]).filter((x) => typeof x === 'string')
    : [];
  const chatOpen = t.status !== 'RESOLVED' && t.status !== 'REJECTED';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/admin/tickets">← Tickets</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section className="border-border bg-card rounded-xl border p-5 lg:sticky lg:top-4">
          <h1 className="text-xl font-semibold tracking-tight">
            Ticket
            <span className="text-muted-foreground ml-2 text-xs font-semibold uppercase tracking-wide">
              {t.status.replace(/_/g, ' ')}
            </span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Reporter <span className="font-mono text-[11px]">{t.reporterDiscordId}</span> · Target{' '}
            <span className="font-mono text-[11px]">{t.targetDiscordId}</span>
            {t.guildId ? (
              <>
                {' '}
                · Guild <span className="font-mono text-[11px]">{t.guildId}</span>
              </>
            ) : null}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <form action={patchTicketAction.bind(null, t.id, 'NEEDS_EVIDENCE')}>
              <Button type="submit" variant="outline" size="sm">
                Request evidence
              </Button>
            </form>
            <form action={patchTicketAction.bind(null, t.id, 'UNDER_REVIEW')}>
              <Button type="submit" variant="outline" size="sm">
                Mark reviewing
              </Button>
            </form>
          </div>

          <div className="mt-4">
            <h2 className="text-sm font-semibold">Report</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <FlagLevelBadge level={t.allegedFlagLevel} />
              <span className="text-muted-foreground text-xs">Status: {t.reportStatus}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{t.reportReason}</p>
          </div>

          {t.userMessage ? (
            <div className="mt-4">
              <h2 className="text-sm font-semibold">Message to user</h2>
              <p className="text-sm">{t.userMessage}</p>
            </div>
          ) : null}

          {t.adminNote ? (
            <div className="bg-surface/40 border-border mt-4 rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground text-xs font-medium uppercase">Staff note</span>
              <p className="mt-1">{t.adminNote}</p>
            </div>
          ) : null}

          {links.length > 0 ? (
            <div className="mt-4">
              <h2 className="text-sm font-semibold">Evidence links</h2>
              <ul className="mt-1 list-inside list-disc text-sm">
                {links.map((u) => (
                  <li key={u}>
                    <a href={u} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {t.attachments.length > 0 ? (
            <div className="mt-4">
              <h2 className="text-sm font-semibold">Attachments</h2>
              <ul className="mt-1 text-sm">
                {t.attachments.map((a) => (
                  <li key={a.id} className="font-mono text-[11px]">
                    {a.mimeType} ({a.sizeBytes} bytes)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {t.reportStatus === 'PENDING' ? (
            <div className="border-border mt-4 border-t pt-4">
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Approve report (sets flag tier)
              </p>
              <div className="flex flex-wrap gap-2">
                {flagActionLevels.map((level: FlagActionLevel) => (
                  <form key={level} action={resolveTicketAction.bind(null, t.id, level)}>
                    <Button type="submit" size="sm" variant="default">
                      {flagLevelDisplayName(level)}
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/admin/users/${t.targetDiscordId}`}>User flags</Link>
            </Button>
          </div>
        </section>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">Conversation</h2>
          <TicketThreadClient
            ticketId={t.id}
            mode="admin"
            initialItems={initialMessages}
            canPost={chatOpen}
          />
        </div>
      </div>
    </div>
  );
}
