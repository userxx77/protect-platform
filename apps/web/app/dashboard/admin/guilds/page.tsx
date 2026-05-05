import { dashboardApi } from '@/lib/api-server';
import Link from 'next/link';

type EntRow = {
  guildId: string;
  discordName: string | null;
  approximateMemberCount: number | null;
  botJoinedAt: string | null;
  removedAt: string | null;
  updatedAt: string;
  entitlement: {
    status: string;
    validFrom: string;
    validUntil: string | null;
    planCode: string | null;
    memberSyncState: string;
    lastMemberSyncAt: string | null;
  } | null;
};

export default async function AdminGuildsPage() {
  let rows: EntRow[];
  try {
    rows = await dashboardApi<EntRow[]>('/admin/guilds');
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Guilds &amp; licenses</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load'} (platform admin only)
        </div>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Guilds &amp; licenses</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Manage entitlements and member sync via API{' '}
        <code className="ds-mono">POST /admin/guilds/:id/entitlement</code> and{' '}
        <code className="ds-mono">POST /admin/guilds/:id/sync-members</code>. This page is read-only.
      </p>
      <div className="ds-table-wrap" style={{ marginTop: '1rem' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Guild ID</th>
              <th>License</th>
              <th>Valid until</th>
              <th>Sync</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.guildId}>
                <td>{r.discordName ?? '—'}</td>
                <td className="ds-mono">{r.guildId}</td>
                <td>{r.entitlement?.status ?? '—'}</td>
                <td className="ds-mono">{r.entitlement?.validUntil ?? '—'}</td>
                <td>{r.entitlement?.memberSyncState ?? '—'}</td>
                <td>
                  <Link href={`/dashboard/my-servers/${r.guildId}`} className="ds-muted">
                    View cache
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="ds-hint">No guilds recorded yet.</p> : null}
    </section>
  );
}
