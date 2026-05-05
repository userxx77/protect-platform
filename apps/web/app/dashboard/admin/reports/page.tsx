import { dashboardApi } from '@/lib/api-server';
import { approveReportAction, rejectReportAction } from './actions';

type PendingItem = {
  id: string;
  reporterDiscordId: string;
  targetDiscordId: string;
  guildId: string | null;
  reason: string;
  createdAt: string;
  ticketId?: string | null;
  ticketStatus?: string | null;
};

type PendingResponse = { items: PendingItem[] };

export default async function AdminReportsPage() {
  let data: PendingResponse;
  try {
    data = await dashboardApi<PendingResponse>('/reports/pending?limit=100');
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Pending reports</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load'} (platform admin only)
        </div>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Pending reports</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Community reports awaiting review before flags apply.
      </p>
      <div className="ds-table-wrap" style={{ marginTop: '1rem' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Target</th>
              <th>Reporter</th>
              <th>Guild</th>
              <th>Ticket</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id}>
                <td className="ds-mono">{r.createdAt}</td>
                <td className="ds-mono">{r.targetDiscordId}</td>
                <td className="ds-mono">{r.reporterDiscordId}</td>
                <td className="ds-mono">{r.guildId ?? '—'}</td>
                <td>
                  {r.ticketId ? (
                    <span className="ds-mono">
                      {r.ticketStatus ?? '—'} · {r.ticketId.slice(0, 8)}…
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ maxWidth: 240 }}>{r.reason}</td>
                <td>
                  <form action={approveReportAction.bind(null, r.id)} style={{ display: 'inline', marginRight: '0.5rem' }}>
                    <button type="submit" className="ds-btn">
                      Approve
                    </button>
                  </form>
                  <form action={rejectReportAction.bind(null, r.id)} style={{ display: 'inline' }}>
                    <button type="submit" className="ds-btn ds-btn-ghost">
                      Reject
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 ? <p className="ds-hint">No pending reports.</p> : null}
    </section>
  );
}
