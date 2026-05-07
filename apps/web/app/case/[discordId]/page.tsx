import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { dashboardApi } from '@/lib/api-server';
import { FlagLevelBadge } from '@/components/flag-level-badge';
import type { UserPublic } from '@protect/shared';

export default async function CasePage({
  params,
}: {
  params: Promise<{ discordId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  const { discordId } = await params;
  if (!/^\d{17,20}$/.test(discordId)) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Case</h1>
        <p className="ds-muted">Invalid Discord user id.</p>
      </section>
    );
  }

  let user: UserPublic;
  try {
    user = await dashboardApi<UserPublic>(`/user/${discordId}`);
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Case</h1>
        <p className="ds-muted">{e instanceof Error ? e.message : 'Could not load user.'}</p>
        <Link href="/dashboard" className="ds-btn" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Reputation case</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Read-only aggregate for investigations. Always verify context before moderating.
      </p>
      <div style={{ marginTop: '1.25rem' }} className="ds-table-wrap">
        <table className="ds-table">
          <tbody>
            <tr>
              <th>User</th>
              <td className="ds-mono">{user.discordId}</td>
            </tr>
            <tr>
              <th>Level</th>
              <td>
                <FlagLevelBadge level={user.flagLevel} />
              </td>
            </tr>
            <tr>
              <th>Score</th>
              <td>{user.flagScore}</td>
            </tr>
            <tr>
              <th>Flags</th>
              <td>{user.flagCount ?? '—'}</td>
            </tr>
            <tr>
              <th>Updated</th>
              <td className="ds-mono">{user.updatedAt}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: '1rem' }} className="ds-hint">
        Staff: open the <Link href={`/dashboard/admin/users/${user.discordId}`}>full flag history</Link> in
        the dashboard.
      </p>
    </section>
  );
}
