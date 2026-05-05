import Link from 'next/link';
import { auth } from '@/auth';
import { dashboardApi } from '@/lib/api-server';

type ResolveItem = {
  guildId: string;
  known?: boolean;
  licensed: boolean;
  discordName?: string | null;
  approximateMemberCount?: number | null;
  entitlement?: { status: string; validUntil: string | null } | null;
};

type ResolveResponse = { items: ResolveItem[] };

export default async function MyServersPage() {
  const session = await auth();
  const manageable = session?.manageableGuilds ?? [];
  const ids = manageable.map((g) => g.id);

  let data: ResolveResponse;
  try {
    data = await dashboardApi<ResolveResponse>('/me/guilds/resolve', {
      method: 'POST',
      body: JSON.stringify({ guildIds: ids.length ? ids : ['000000000000000000'] }),
    });
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">My servers</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load'}
        </div>
      </section>
    );
  }

  const items = ids.length ? data.items.filter((i) => ids.includes(i.guildId)) : [];

  return (
    <section className="ds-card">
      <h1 className="ds-h1">My servers</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Guilds where you have <strong>Manage Server</strong>. An active license unlocks reporting workflows
        and member cache views.
      </p>
      <ul style={{ marginTop: '1rem', listStyle: 'none', padding: 0 }}>
        {items.map((item) => {
          const name = manageable.find((g) => g.id === item.guildId)?.name ?? item.discordName;
          return (
            <li key={item.guildId} className="ds-card" style={{ marginBottom: '0.75rem', padding: '1rem' }}>
              <strong>{name ?? 'Guild'}</strong>{' '}
              <span className="ds-mono ds-muted">{item.guildId}</span>
              <div style={{ marginTop: '0.5rem' }} className="ds-muted">
                License: {item.licensed ? 'active' : 'inactive / none'}{' '}
                {item.entitlement?.status ? `(${item.entitlement.status})` : ''}
              </div>
              {item.licensed ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <Link
                    href={`/dashboard/my-servers/${item.guildId}`}
                    className="ds-btn"
                    style={{ fontSize: '0.875rem' }}
                  >
                    View member cache
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {items.length === 0 ? (
        <p className="ds-hint">No manageable servers from Discord in this session.</p>
      ) : null}
    </section>
  );
}
