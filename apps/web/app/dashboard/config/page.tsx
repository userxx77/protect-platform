import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { saveServerConfig } from './actions';
import { dashboardApi } from '@/lib/api-server';

type ServerRow = {
  guildId: string;
  updatedAt: string;
  alertChannelId: string | null;
  alertMinLevel: string | null;
};

export default async function ServerConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }

  let servers: ServerRow[] = [];
  let listError: string | null = null;
  try {
    servers = await dashboardApi<ServerRow[]>('/servers');
  } catch (e) {
    listError = e instanceof Error ? e.message : 'Could not load server list';
  }

  const manageable = session.manageableGuilds ?? [];

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Server configuration</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Saves alert settings per guild (API admin). Discord: use <code>/config</code> with{' '}
        <strong>Manage Server</strong>. Guild appears here after the first save.
      </p>
      {sp?.saved ? (
        <div className="ds-alert ds-alert-success" style={{ marginTop: '1rem' }}>
          Saved.
        </div>
      ) : null}
      {sp?.error ? (
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          Error: {sp.error}
        </div>
      ) : null}
      {listError ? (
        <div className="ds-alert ds-alert-warn" style={{ marginTop: '1rem' }}>
          {listError}{' '}
          <small>(Are you in `ADMIN_DISCORD_IDS` or `platform_accounts` ADMIN?)</small>
        </div>
      ) : null}
      {manageable.length === 0 ? (
        <p className="ds-hint" style={{ marginTop: '1rem' }}>
          No guilds with <strong>Manage Server</strong> in this login session. Sign out and sign in
          again after upgrading OAuth scopes, or paste a guild ID manually.
        </p>
      ) : null}

      {servers.length > 0 ? (
        <>
          <h2 className="ds-h2">Configured servers</h2>
          <div className="ds-table-wrap" style={{ maxWidth: 720 }}>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Guild ID</th>
                  <th>Alert channel</th>
                  <th>Min level</th>
                  <th>Updated (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.guildId}>
                    <td className="ds-mono">{s.guildId}</td>
                    <td className="ds-mono">{s.alertChannelId ?? '—'}</td>
                    <td>{s.alertMinLevel ?? '—'}</td>
                    <td className="ds-mono">{s.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p style={{ marginBottom: '1rem' }} className="ds-hint">
          No servers in the database yet.
        </p>
      )}

      <h2 className="ds-h2">{servers.length ? 'Update or add' : 'Add'} configuration</h2>
      <form action={saveServerConfig}>
        <div className="ds-field">
          <label htmlFor="guildId" className="ds-label">
            Guild ID
          </label>
          <input
            id="guildId"
            name="guildId"
            required
            list="guild-pick"
            placeholder="Discord guild snowflake (use suggestions if available)"
            className="ds-input"
          />
          <datalist id="guild-pick">
            {manageable.map((g) => (
              <option key={g.id} value={g.id} label={g.name} />
            ))}
          </datalist>
        </div>
        <div className="ds-field">
          <label htmlFor="alertChannelId" className="ds-label">
            Alert channel ID (optional)
          </label>
          <input
            id="alertChannelId"
            name="alertChannelId"
            placeholder="Text channel snowflake"
            className="ds-input"
          />
        </div>
        <div className="ds-field">
          <label htmlFor="alertMinLevel" className="ds-label">
            Minimum level to alert
          </label>
          <select
            id="alertMinLevel"
            name="alertMinLevel"
            defaultValue="SUSPICIOUS"
            className="ds-select"
          >
            <option value="CLEAN">CLEAN</option>
            <option value="SUSPICIOUS">SUSPICIOUS</option>
            <option value="HIGH_RISK">HIGH_RISK</option>
            <option value="CONFIRMED_CHEATER">CONFIRMED_CHEATER</option>
          </select>
        </div>
        <button type="submit" className="ds-btn">
          Save
        </button>
      </form>
    </section>
  );
}
