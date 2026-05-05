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
      <section>
        <h1>Audit log</h1>
        <p style={{ color: '#f88' }}>
          {e instanceof Error ? e.message : 'Failed to load audit log'}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>Audit log</h1>
      <table>
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
              <td>{r.timestamp}</td>
              <td>{r.action}</td>
              <td>{r.actorDiscordId ?? '—'}</td>
              <td>{r.targetId ?? '—'}</td>
              <td>
                {r.entityType}:{r.entityId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
