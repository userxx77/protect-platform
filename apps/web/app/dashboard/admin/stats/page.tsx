import { dashboardApi } from '@/lib/api-server';
import Link from 'next/link';

type Stats = {
  guildsActive: number;
  trackedMemberDistinct: number;
  usersFlagged: number;
  manualChecksTotal: number;
  updatedAt: string;
};

export default async function AdminStatsPage() {
  let stats: Stats;
  try {
    stats = await dashboardApi<Stats>('/admin/platform-stats');
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Platform snapshot</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load'} (platform admin only)
        </div>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Platform snapshot</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Aggregates refreshed by the worker; manual <code className="ds-mono">/check</code> bumps the last counter.
      </p>
      <div
        style={{
          marginTop: '1.25rem',
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        }}
      >
        <div className="ds-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)' }}>
          <div className="ds-muted" style={{ fontSize: '0.85rem' }}>
            Active servers
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{stats.guildsActive}</div>
        </div>
        <div className="ds-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)' }}>
          <div className="ds-muted" style={{ fontSize: '0.85rem' }}>
            Distinct cached members
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {stats.trackedMemberDistinct.toLocaleString()}
          </div>
        </div>
        <div className="ds-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)' }}>
          <div className="ds-muted" style={{ fontSize: '0.85rem' }}>
            Non-clean profiles
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{stats.usersFlagged}</div>
        </div>
        <div className="ds-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)' }}>
          <div className="ds-muted" style={{ fontSize: '0.85rem' }}>
            Manual checks
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {stats.manualChecksTotal.toLocaleString()}
          </div>
        </div>
      </div>
      <p className="ds-hint" style={{ marginTop: '1rem' }}>
        Updated {new Date(stats.updatedAt).toLocaleString()} ·{' '}
        <Link href="/dashboard/admin/guilds" className="ds-muted">
          Guilds &amp; licenses
        </Link>
      </p>
    </section>
  );
}
