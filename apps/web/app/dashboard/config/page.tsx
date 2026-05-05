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
    <section>
      <h1>Server configuration</h1>
      <p>
        Saves alert settings per guild (API admin). Discord: use <code>/config</code> with{' '}
        <strong>Manage Server</strong>. Guild appears here after the first save.
      </p>
      {sp?.saved ? <p style={{ color: 'green' }}>Saved.</p> : null}
      {sp?.error ? <p style={{ color: '#f88' }}>Error: {sp.error}</p> : null}
      {listError ? (
        <p style={{ color: '#fa0' }}>
          {listError}{' '}
          <small>(Are you in `ADMIN_DISCORD_IDS` or `platform_accounts` ADMIN?)</small>
        </p>
      ) : null}
      {manageable.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>
          No guilds with <strong>Manage Server</strong> in this login session. Sign out and sign in
          again after upgrading OAuth scopes, or paste a guild ID manually.
        </p>
      ) : null}

      {servers.length > 0 ? (
        <>
          <h2>Configured servers</h2>
          <table style={{ borderCollapse: 'collapse', marginBottom: '1.5rem', width: '100%', maxWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Guild ID</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Alert channel</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Min level</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Updated (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.guildId} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {s.guildId}
                  </td>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {s.alertChannelId ?? '—'}
                  </td>
                  <td style={{ padding: 8 }}>{s.alertMinLevel ?? '—'}</td>
                  <td style={{ padding: 8, fontSize: '0.85rem' }}>{s.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p style={{ marginBottom: '1rem' }}>No servers in the database yet.</p>
      )}

      <h2>{servers.length ? 'Update or add' : 'Add'} configuration</h2>
      <form action={saveServerConfig}>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="guildId">Guild ID</label>
          <br />
          <input
            id="guildId"
            name="guildId"
            required
            list="guild-pick"
            placeholder="Discord guild snowflake (use suggestions if available)"
            style={{ width: '100%', maxWidth: 420, marginTop: 4 }}
          />
          <datalist id="guild-pick">
            {manageable.map((g) => (
              <option key={g.id} value={g.id} label={g.name} />
            ))}
          </datalist>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="alertChannelId">Alert channel ID (optional)</label>
          <br />
          <input
            id="alertChannelId"
            name="alertChannelId"
            placeholder="Text channel snowflake"
            style={{ width: '100%', maxWidth: 420, marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="alertMinLevel">Minimum level to alert</label>
          <br />
          <select
            id="alertMinLevel"
            name="alertMinLevel"
            defaultValue="SUSPICIOUS"
            style={{ marginTop: 4 }}
          >
            <option value="CLEAN">CLEAN</option>
            <option value="SUSPICIOUS">SUSPICIOUS</option>
            <option value="HIGH_RISK">HIGH_RISK</option>
            <option value="CONFIRMED_CHEATER">CONFIRMED_CHEATER</option>
          </select>
        </div>
        <button type="submit">Save</button>
      </form>
    </section>
  );
}
