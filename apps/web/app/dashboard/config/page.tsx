import { saveServerConfig } from './actions';

export default function ServerConfigPage() {
  return (
    <section>
      <h1>Server configuration</h1>
      <p>Merge-updates alert settings for a guild. Requires administrator access on the API.</p>
      <form action={saveServerConfig}>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="guildId">Guild ID</label>
          <br />
          <input
            id="guildId"
            name="guildId"
            required
            placeholder="Discord guild snowflake"
            style={{ width: '100%', maxWidth: 420, marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="alertChannelId">Alert channel ID (optional)</label>
          <br />
          <input
            id="alertChannelId"
            name="alertChannelId"
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
