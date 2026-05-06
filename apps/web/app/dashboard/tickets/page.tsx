import { dashboardApi } from '@/lib/api-server';
import { TicketsPageClient, type TicketRow } from '@/app/dashboard/tickets/tickets-page-client';

type ListResponse = {
  items: TicketRow[];
  ticketBuckets: { open: number; pending: number; closed: number };
};

export default async function MyTicketsPage() {
  let data: ListResponse;
  try {
    data = await dashboardApi<ListResponse>('/me/tickets');
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Support tickets</h1>
        <p className="text-muted-foreground mt-2">
          {e instanceof Error ? e.message : 'Failed to load'} (User role required for tickets.)
        </p>
      </div>
    );
  }

  return <TicketsPageClient items={data.items} buckets={data.ticketBuckets} />;
}
