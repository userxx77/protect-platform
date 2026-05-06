import { auth } from '@/auth';
import { saveServerConfig } from './actions';
import { dashboardApi } from '@/lib/api-server';

type ServerRow = {
  guildId: string;
  updatedAt: string;
  alertChannelId: string | null;
  alertMinLevel: string | null;
  joinHoldEnabled: boolean | null;
  joinHoldDurationMinutes: number | null;
  joinHoldMinLevel: string | null;
};

export default async function ServerConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();

  let servers: ServerRow[] = [];
  let listError: string | null = null;
  try {
    servers = await dashboardApi<ServerRow[]>('/servers');
  } catch (e) {
    listError = e instanceof Error ? e.message : 'Could not load server list';
  }

  const manageable = session?.manageableGuilds ?? [];

  return (
    <section className="ds-card">
      <h1 className="ds-h1">Server configuration</h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Saves alert and join-hold settings per guild (API admin). Discord: use <code>/config</code>{' '}
        with <strong>Manage Server</strong>. Guild appears here after the first save.
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
          <div className="ds-table-wrap" style={{ maxWidth: 960 }}>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Guild ID</th>
                  <th>Alert channel</th>
                  <th>Alert min</th>
                  <th>Join hold</th>
                  <th>Hold min</th>
                  <th>Hold min (m)</th>
                  <th>Updated (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.guildId}>
                    <td className="ds-mono">{s.guildId}</td>
                    <td className="ds-mono">{s.alertChannelId ?? '—'}</td>
                    <td>{s.alertMinLevel ?? '—'}</td>
                    <td>{s.joinHoldEnabled === true ? 'On' : s.joinHoldEnabled === false ? 'Off' : '—'}</td>
                    <td>{s.joinHoldMinLevel ?? '—'}</td>
                    <td>{s.joinHoldDurationMinutes ?? '—'}</td>
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
            <option value="">— omit —</option>
            <option value="CLEAN">CLEAN</option>
            <option value="SUSPICIOUS">SUSPICIOUS</option>
            <option value="HIGH_RISK">HIGH_RISK</option>
            <option value="CONFIRMED_CHEATER">CONFIRMED_CHEATER</option>
          </select>
        </div>
        <div className="ds-field">
          <label htmlFor="joinHoldEnabled" className="ds-label">
            Join hold (communication timeout + moderation buttons)
          </label>
          <select id="joinHoldEnabled" name="joinHoldEnabled" className="ds-select" defaultValue="unchanged">
            <option value="unchanged">Leave unchanged</option>
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
        </div>
        <div className="ds-field">
          <label htmlFor="joinHoldDurationMinutes" className="ds-label">
            Hold duration (minutes, 1–40320; optional)
          </label>
          <input
            id="joinHoldDurationMinutes"
            name="joinHoldDurationMinutes"
            type="number"
            min={1}
            max={40320}
            placeholder="60"
            className="ds-input"
          />
        </div>
        <div className="ds-field">
          <label htmlFor="joinHoldMinLevel" className="ds-label">
            Minimum level for join hold (optional)
          </label>
          <select id="joinHoldMinLevel" name="joinHoldMinLevel" className="ds-select" defaultValue="">
            <option value="">— omit —</option>
            <option value="CLEAN">CLEAN</option>
            <option value="SUSPICIOUS">SUSPICIOUS</option>
            <option value="HIGH_RISK">HIGH_RISK</option>
            <option value="CONFIRMED_CHEATER">CONFIRMED_CHEATER</option>
          </select>
        </div>
        <p className="ds-hint" style={{ marginBottom: '1rem' }}>
          Only fields you fill in are sent; others stay as stored on the server. Use Discord{' '}
          <code>/config view</code> to read the merged effective config.
        </p>
        <button type="submit" className="ds-btn">
          Save
        </button>
      </form>
    </section>
  );
}
