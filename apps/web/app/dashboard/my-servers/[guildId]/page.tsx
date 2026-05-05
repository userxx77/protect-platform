import Link from 'next/link';
import { auth } from '@/auth';
import { dashboardApi } from '@/lib/api-server';
import { userAvatarUrl } from '@/lib/discord-cdn';

type MembersRes = {
  guildId: string;
  items: Array<{
    discordUserId: string;
    username: string | null;
    globalName: string | null;
    avatarHash: string | null;
    firstSeenAt: string;
    source: string;
  }>;
};

export default async function GuildMembersPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const session = await auth();
  const manageable = session?.manageableGuilds ?? [];
  const manageableParam = manageable.map((g) => g.id).join(',');

  let data: MembersRes;
  try {
    const q = manageableParam ? `?manageable=${encodeURIComponent(manageableParam)}` : '';
    data = await dashboardApi<MembersRes>(`/me/guilds/${guildId}/members${q}`);
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Member cache</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load'}
        </div>
        <p className="ds-hint" style={{ marginTop: '1rem' }}>
          <Link href="/dashboard/my-servers">Back to my servers</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Member cache</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Guild <span className="ds-mono">{data.guildId}</span> — up to 500 rows (batched sync from bot).
      </p>
      <p style={{ marginTop: '0.75rem' }}>
        <Link href="/dashboard/my-servers" className="ds-muted">
          ← Back
        </Link>
      </p>
      <div className="ds-table-wrap" style={{ marginTop: '1rem' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th aria-label="Avatar" />
              <th>Member</th>
              <th>Username</th>
              <th>User ID</th>
              <th>First seen</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => {
              const av = userAvatarUrl(r.discordUserId, r.avatarHash);
              const display = r.globalName?.trim() || r.username?.trim() || null;
              return (
                <tr key={r.discordUserId}>
                  <td style={{ width: 44, verticalAlign: 'middle' }}>
                    {av ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={av} alt="" width={32} height={32} style={{ borderRadius: '50%' }} />
                    ) : (
                      <span className="ds-muted">—</span>
                    )}
                  </td>
                  <td>{display ?? <span className="ds-muted">—</span>}</td>
                  <td className="ds-mono" style={{ fontSize: '0.88rem' }}>
                    {r.username ? `@${r.username}` : '—'}
                  </td>
                  <td className="ds-mono" style={{ fontSize: '0.85rem' }}>
                    {r.discordUserId}
                  </td>
                  <td className="ds-mono">{r.firstSeenAt}</td>
                  <td>{r.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 ? <p className="ds-hint">No cached members yet — run admin sync.</p> : null}
    </section>
  );
}
