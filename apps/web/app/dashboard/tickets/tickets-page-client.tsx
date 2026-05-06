'use client';

import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FlagLevelBadge } from '@/components/flag-level-badge';

export type TicketRow = {
  id: string;
  status: string;
  reportId: string;
  createdAt: string;
  updatedAt: string;
  targetDiscordId: string;
  reportStatus: string;
  reportReason: string;
  allegedFlagLevel?: string | null;
};

function ticketBucket(status: string): 'open' | 'pending' | 'closed' {
  if (status === 'OPEN' || status === 'NEEDS_EVIDENCE') return 'open';
  if (status === 'EVIDENCE_SUBMITTED' || status === 'UNDER_REVIEW') return 'pending';
  return 'closed';
}

export function TicketsPageClient({
  items,
  buckets,
}: {
  items: TicketRow[];
  buckets: { open: number; pending: number; closed: number };
}) {
  const openItems = items.filter((t) => ticketBucket(t.status) === 'open');
  const pendItems = items.filter((t) => ticketBucket(t.status) === 'pending');
  const closedItems = items.filter((t) => ticketBucket(t.status) === 'closed');

  function List({ list }: { list: TicketRow[] }) {
    if (!list.length) {
      return (
        <div className="ds-muted border-border rounded-[calc(var(--radius)-4px)] border border-dashed p-8 text-center text-sm">
          No tickets in this tab.
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3">
        {list.map((t) => (
          <div key={t.id} className="ds-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <FlagLevelBadge level={t.allegedFlagLevel} />
                <span className="text-muted-foreground border-border rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  {t.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium leading-snug">{t.reportReason}</p>
                <p className="ds-muted ds-mono mt-1 text-[11px]">
                  Target {t.targetDiscordId} · updated {t.updatedAt}
                </p>
              </div>
              <Link href={`/dashboard/tickets/${t.id}`} className="ds-btn shrink-0 self-start sm:self-center">
                Open
              </Link>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <section className="ds-card mb-6">
        <h1 className="ds-h1">My tickets</h1>
        <p className="ds-muted mt-1">
          Linked to your community reports. Open / pending / closed:{' '}
          <span className="text-foreground font-medium">
            {buckets.open} · {buckets.pending} · {buckets.closed}
          </span>
        </p>
      </section>

      <Tabs defaultValue="open">
        <TabsList className="ds-tabs-row !border-border !bg-surface/40 !h-auto min-h-9 w-full justify-start gap-1 border !p-1">
          <TabsTrigger value="open">Open ({openItems.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendItems.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedItems.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open">
          <List list={openItems} />
        </TabsContent>
        <TabsContent value="pending">
          <List list={pendItems} />
        </TabsContent>
        <TabsContent value="closed">
          <List list={closedItems} />
        </TabsContent>
      </Tabs>
    </>
  );
}
