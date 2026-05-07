import { dashboardApi } from '@/lib/api-server';
import { PendingReportsQueue, type PendingReportItem } from './pending-reports-queue';

type PendingResponse = { items: PendingReportItem[] };

export default async function AdminReportsPage() {
  let data: PendingResponse;
  try {
    data = await dashboardApi<PendingResponse>('/reports/pending?limit=100');
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Reports queue</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Failed to load'} (platform admin only)
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meldingen beoordelen</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Openstaande community-meldingen. <strong>Accepteren</strong> past de gekozen tier toe;{' '}
          <strong>Weigeren</strong> sluit de melding. Nieuwe items verschijnen ook in Discord als{' '}
          <code className="text-foreground">DISCORD_ADMIN_FEED_CHANNEL_ID</code> op de bot staat.
        </p>
      </div>
      <PendingReportsQueue items={data.items} />
    </section>
  );
}
