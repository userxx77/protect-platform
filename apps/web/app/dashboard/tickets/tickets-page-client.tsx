'use client';

import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type TicketRow = {
  id: string;
  status: string;
  reportId: string;
  createdAt: string;
  updatedAt: string;
  targetDiscordId: string;
  reportStatus: string;
  reportReason: string;
};

function ticketBucket(status: string): 'open' | 'pending' | 'closed' {
  if (status === 'OPEN' || status === 'NEEDS_EVIDENCE') return 'open';
  if (status === 'EVIDENCE_SUBMITTED' || status === 'UNDER_REVIEW') return 'pending';
  return 'closed';
}

const statusBadge = (status: string) => {
  const b = ticketBucket(status);
  if (b === 'open') return 'warning' as const;
  if (b === 'pending') return 'primary' as const;
  return 'muted' as const;
};

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
        <div className="border-border text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          No tickets in this tab.
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3">
        {list.map((t) => (
          <Card key={t.id} className="!p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-muted-foreground font-mono text-[11px]">{t.id.slice(0, 8)}…</div>
              <div className="flex-1 truncate font-medium">{t.reportReason}</div>
              <Badge variant={statusBadge(t.status)}>{t.status}</Badge>
              <div className="text-muted-foreground hidden text-[11px] sm:block">{t.updatedAt}</div>
              <Link
                href={`/dashboard/tickets/${t.id}`}
                className="text-primary text-xs font-medium hover:underline"
              >
                View
              </Link>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My tickets</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Support tickets linked to your community reports. Open / pending / closed:{' '}
          <span className="text-foreground font-medium">
            {buckets.open} · {buckets.pending} · {buckets.closed}
          </span>
        </p>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">
            Open ({openItems.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendItems.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed ({closedItems.length})
          </TabsTrigger>
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
