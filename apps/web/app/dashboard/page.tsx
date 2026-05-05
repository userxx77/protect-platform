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
      <section>
        <h1>Flagged users</h1>
        <p style={{ color: '#f88' }}>
          Could not load data. Ensure your Discord account is listed in{' '}
          <code>ADMIN_DISCORD_IDS</code> on the API and JWT secrets match.{' '}
          {e instanceof Error ? e.message : ''}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>Flagged users</h1>
      <table>
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
              <td>{u.discordId}</td>
              <td>{u.flagLevel}</td>
              <td>{u.flagScore}</td>
              <td>{u.flagCount ?? '—'}</td>
              <td>{u.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.items.length === 0 ? <p>No non-clean users yet.</p> : null}
    </section>
  );
}
