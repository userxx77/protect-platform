import { dashboardApi } from '@/lib/api-server';
import Link from 'next/link';
import { guildIconUrl } from '@/lib/discord-cdn';
import { GuildSyncButton } from './guild-sync-button';

type EntRow = {
  guildId: string;
  discordName: string | null;
  iconHash: string | null;
  approximateMemberCount: number | null;
  ownerDiscordId: string | null;
  vanityUrlCode: string | null;
  premiumTier: number | null;
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
        Entitlements: API{' '}
        <code className="ds-mono">POST /admin/guilds/:id/entitlement</code> or Discord{' '}
        <code className="ds-mono">/sentra-admin</code>. Member cache: use <strong>Sync now</strong> per row
        or the same POST as before.
      </p>
      <div className="ds-table-wrap" style={{ marginTop: '1rem' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th aria-label="Icon" />
              <th>Name</th>
              <th>Guild ID</th>
              <th>Owner</th>
              <th>License</th>
              <th>Valid until</th>
              <th>Sync</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ic = guildIconUrl(r.guildId, r.iconHash);
              return (
              <tr key={r.guildId}>
                <td style={{ width: 48 }}>
                  {ic ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ic} alt="" width={36} height={36} style={{ borderRadius: 8 }} />
                  ) : (
                    <span className="ds-muted">—</span>
                  )}
                </td>
                <td>
                  {r.discordName ?? '—'}
                  {r.vanityUrlCode ? (
                    <span className="ds-muted" style={{ display: 'block', fontSize: '0.8rem' }}>
                      .gg/{r.vanityUrlCode}
                    </span>
                  ) : null}
                </td>
                <td className="ds-mono">{r.guildId}</td>
                <td className="ds-mono">{r.ownerDiscordId ?? '—'}</td>
                <td>{r.entitlement?.status ?? '—'}</td>
                <td className="ds-mono">{r.entitlement?.validUntil ?? '—'}</td>
                <td>{r.entitlement?.memberSyncState ?? '—'}</td>
                <td>
                  <GuildSyncButton guildId={r.guildId} />
                  <Link
                    href={`/dashboard/my-servers/${r.guildId}`}
                    className="ds-muted"
                    style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.85rem' }}
                  >
                    View cache
                  </Link>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="ds-hint">No guilds recorded yet.</p> : null}
    </section>
  );
}
