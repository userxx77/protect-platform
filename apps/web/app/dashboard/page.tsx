import { dashboardApi } from '@/lib/api-server';

type FlaggedResponse = {
  items: Array<{
    discordId: string;
    flagLevel: string;
    flagScore: number;
    flagCount?: number;
    updatedAt: string;
  }>;
  nextCursor?: string;
};

export default async function DashboardFlaggedPage() {
  let data: FlaggedResponse;
  try {
    data = await dashboardApi<FlaggedResponse>('/users/flagged?limit=50');
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Flagged users</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          Could not load data. Ensure your Discord account is listed in{' '}
          <code>ADMIN_DISCORD_IDS</code> on the API and JWT secrets match.{' '}
          {e instanceof Error ? e.message : ''}
        </div>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Flagged users</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Non-clean users and recent scores (API admin).
      </p>
      <div className="ds-table-wrap">
        <table className="ds-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Level</th>
              <th>Score</th>
              <th># Flags</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.discordId}>
                <td className="ds-mono">{u.discordId}</td>
                <td>{u.flagLevel}</td>
                <td>{u.flagScore}</td>
                <td>{u.flagCount ?? '—'}</td>
                <td className="ds-mono">{u.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 ? <p className="ds-hint">No non-clean users yet.</p> : null}
    </section>
  );
}
