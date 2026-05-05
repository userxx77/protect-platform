import { dashboardApi } from '@/lib/api-server';

type AuditRow = {
  id: string;
  timestamp: string;
  actorDiscordId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  targetId: string | null;
  metadata: unknown;
};

type AuditListResponse = { items: AuditRow[]; nextCursor?: string };

export default async function AuditPage() {
  let data: AuditListResponse;
  try {
    data = await dashboardApi<AuditListResponse>('/audit?limit=100');
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Audit log</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load audit log'}
        </div>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Audit log</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Recent actions (read-only).
      </p>
      <div className="ds-table-wrap">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id}>
                <td className="ds-mono">{r.timestamp}</td>
                <td>{r.action}</td>
                <td className="ds-mono">{r.actorDiscordId ?? '—'}</td>
                <td className="ds-mono">{r.targetId ?? '—'}</td>
                <td>
                  {r.entityType}:{r.entityId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 ? <p className="ds-hint">No audit entries yet.</p> : null}
    </section>
  );
}
