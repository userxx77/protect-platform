import Link from 'next/link';
import { dashboardApi } from '@/lib/api-server';

type TicketRow = {
  id: string;
  status: string;
  reportId: string;
  createdAt: string;
  updatedAt: string;
  targetDiscordId: string;
  reportStatus: string;
  reportReason: string;
};

type ListResponse = { items: TicketRow[] };

export default async function MyTicketsPage() {
  let data: ListResponse;
  try {
    data = await dashboardApi<ListResponse>('/me/tickets');
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Support tickets</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load'} (User role required for tickets.)
        </div>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Support tickets</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Evidence and updates linked to your community reports.
      </p>
      <div className="ds-table-wrap" style={{ marginTop: '1rem' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Updated</th>
              <th>Status</th>
              <th>Target</th>
              <th>Report</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t.id}>
                <td className="ds-mono">{t.updatedAt}</td>
                <td>{t.status}</td>
                <td className="ds-mono">{t.targetDiscordId}</td>
                <td style={{ maxWidth: 200 }}>{t.reportReason}</td>
                <td>
                  <Link className="ds-btn ds-btn-ghost" href={`/dashboard/tickets/${t.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 ? <p className="ds-hint">No tickets yet.</p> : null}
    </section>
  );
}
