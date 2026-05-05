import Link from 'next/link';
import { dashboardApi } from '@/lib/api-server';
import { patchTicketAction, resolveTicketAction } from './actions';

type TicketRow = {
  id: string;
  status: string;
  reportId: string;
  guildId: string | null;
  reporterDiscordId: string;
  createdAt: string;
  updatedAt: string;
  targetDiscordId: string;
  reportStatus: string;
  adminNote: string | null;
};

type ListResponse = { items: TicketRow[] };

export default async function AdminTicketsPage() {
  let data: ListResponse;
  try {
    data = await dashboardApi<ListResponse>('/admin/tickets');
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Tickets</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load'}
        </div>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Support tickets</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Evidence workflow tied to community reports.
      </p>
      <div className="ds-table-wrap" style={{ marginTop: '1rem' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Updated</th>
              <th>Status</th>
              <th>Target</th>
              <th>Reporter</th>
              <th>Report</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t.id}>
                <td className="ds-mono">{t.updatedAt}</td>
                <td>{t.status}</td>
                <td className="ds-mono">{t.targetDiscordId}</td>
                <td className="ds-mono">{t.reporterDiscordId}</td>
                <td className="ds-mono">{t.reportStatus}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <form
                      action={patchTicketAction.bind(null, t.id, 'NEEDS_EVIDENCE')}
                      style={{ display: 'inline' }}
                    >
                      <button type="submit" className="ds-btn ds-btn-ghost" title="Ask reporter for evidence">
                        Request evidence
                      </button>
                    </form>
                    <form
                      action={patchTicketAction.bind(null, t.id, 'UNDER_REVIEW')}
                      style={{ display: 'inline' }}
                    >
                      <button type="submit" className="ds-btn ds-btn-ghost">
                        Mark reviewing
                      </button>
                    </form>
                    {t.reportStatus === 'PENDING' ? (
                      <form action={resolveTicketAction.bind(null, t.id)} style={{ display: 'inline' }}>
                        <button type="submit" className="ds-btn">
                          Approve report
                        </button>
                      </form>
                    ) : null}
                    <Link className="ds-btn ds-btn-ghost" href={`/dashboard/admin/users/${t.targetDiscordId}`}>
                      User flags
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 ? <p className="ds-hint">No tickets.</p> : null}
    </section>
  );
}
