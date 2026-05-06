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
      <section className="ds-card">
        <h1 className="ds-h1">Support tickets</h1>
        <div className="ds-alert ds-alert-error mt-4">
          {e instanceof Error ? e.message : 'Failed to load'} (User role required for tickets.)
        </div>
      </section>
    );
  }

  return <TicketsPageClient items={data.items} buckets={data.ticketBuckets} />;
}
