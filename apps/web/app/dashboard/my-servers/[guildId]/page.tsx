import Link from 'next/link';
import { auth } from '@/auth';
import { dashboardApi } from '@/lib/api-server';
import { userAvatarUrl } from '@/lib/discord-cdn';

const PAGE_SIZE = 10;

type MembersRes = {
  guildId: string;
  take: number;
  skip: number;
  hasMore: boolean;
  nextSkip: number | null;
  items: Array<{
    discordUserId: string;
    username: string | null;
    globalName: string | null;
    avatarHash: string | null;
    firstSeenAt: string;
    source: string;
  }>;
};

function pageHref(guildId: string, page: number) {
  const q = page <= 1 ? '' : `?page=${page}`;
  return `/dashboard/my-servers/${guildId}${q}`;
}

export default async function GuildMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { guildId } = await params;
  const sp = await searchParams;
  const pageRaw = sp.page !== undefined ? Number(sp.page) : 1;
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const session = await auth();
  const manageable = session?.manageableGuilds ?? [];
  const manageableParam = manageable.map((g) => g.id).join(',');

  let data: MembersRes;
  try {
    const qs = new URLSearchParams();
    if (manageableParam) qs.set('manageable', manageableParam);
    qs.set('take', String(PAGE_SIZE));
    qs.set('skip', String(skip));
    const q = `?${qs.toString()}`;
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
        Guild <span className="ds-mono">{data.guildId}</span> — {PAGE_SIZE} members per page
        (synced via bot).
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
      {data.items.length === 0 ? (
        <p className="ds-hint">No cached members yet — run admin sync.</p>
      ) : null}

      {(page > 1 || data.hasMore) && (
        <div
          className="ds-muted"
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>
            Page {page}
            {data.hasMore || page > 1 ? ` · showing ${data.items.length} rows` : null}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {page > 1 ? (
              <Link href={pageHref(guildId, page - 1)} className="ds-btn ds-btn-ghost">
                Previous
              </Link>
            ) : (
              <span className="ds-btn ds-btn-ghost" style={{ opacity: 0.45, pointerEvents: 'none' }}>
                Previous
              </span>
            )}
            {data.hasMore ? (
              <Link href={pageHref(guildId, page + 1)} className="ds-btn ds-btn-ghost">
                Next
              </Link>
            ) : (
              <span className="ds-btn ds-btn-ghost" style={{ opacity: 0.45, pointerEvents: 'none' }}>
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
