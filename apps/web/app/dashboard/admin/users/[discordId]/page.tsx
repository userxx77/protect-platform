import Link from 'next/link';
import { dashboardApi } from '@/lib/api-server';
import { deleteFlagAction, patchFlagAction } from './actions';

type FlagRow = {
  id: string;
  weight: number;
  reason: string;
  source: string;
  actorDiscordId: string;
  guildId: string | null;
  createdAt: string;
};

type FlagsResponse = {
  discordId: string;
  flagScore: number;
  flagLevel: string;
  items: FlagRow[];
};

export default async function AdminUserFlagsPage({
  params,
}: {
  params: Promise<{ discordId: string }>;
}) {
  const { discordId } = await params;
  let data: FlagsResponse;
  try {
    data = await dashboardApi<FlagsResponse>(`/admin/users/${discordId}/flags`);
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">User flags</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load'}
        </div>
      </section>
    );
  }

  return (
    <section className="ds-card">
      <p>
        <Link href="/dashboard">← Flagged users</Link>
      </p>
      <h1 className="ds-h1" style={{ marginTop: '0.75rem' }}>
        Flags · <span className="ds-mono">{data.discordId}</span>
      </h1>
      <p className="ds-muted">
        Level <strong>{data.flagLevel}</strong> · Score <strong>{data.flagScore}</strong>
      </p>
      <div className="ds-table-wrap" style={{ marginTop: '1rem' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Weight</th>
              <th>Source</th>
              <th>Reason</th>
              <th>Actor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((f) => (
              <tr key={f.id}>
                <td className="ds-mono">{f.createdAt}</td>
                <td>{f.weight}</td>
                <td>{f.source}</td>
                <td style={{ maxWidth: 220 }}>{f.reason}</td>
                <td className="ds-mono">{f.actorDiscordId}</td>
                <td>
                  <form
                    action={deleteFlagAction.bind(null, discordId, f.id)}
                    style={{ display: 'inline', marginRight: '0.35rem' }}
                  >
                    <button type="submit" className="ds-btn ds-btn-ghost">
                      Delete
                    </button>
                  </form>
                  <details style={{ display: 'inline-block', marginTop: '0.25rem' }}>
                    <summary className="ds-hint">Edit</summary>
                    <form
                      action={patchFlagAction.bind(null, discordId, f.id)}
                      style={{ marginTop: '0.5rem', padding: '0.5rem', border: '1px solid #333' }}
                    >
                      <label>
                        Reason
                        <input className="ds-input" name="reason" defaultValue={f.reason} style={{ display: 'block' }} />
                      </label>
                      <label style={{ display: 'block', marginTop: '0.35rem' }}>
                        Weight
                        <input
                          className="ds-input"
                          name="weight"
                          type="number"
                          defaultValue={f.weight}
                          style={{ display: 'block' }}
                        />
                      </label>
                      <button type="submit" className="ds-btn" style={{ marginTop: '0.5rem' }}>
                        Save
                      </button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 ? <p className="ds-hint">No flags.</p> : null}
    </section>
  );
}
