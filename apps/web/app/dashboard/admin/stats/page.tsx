import Link from 'next/link';
import { dashboardApi } from '@/lib/api-server';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { DetectionsChart } from '@/components/dashboard/DetectionsChart';
import { Users, Server, Flag, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

type PlatformSnapshot = {
  guildsActive: number;
  trackedMemberDistinct: number;
  usersFlagged: number;
  manualChecksTotal: number;
  updatedAt: string;
};

type SeriesPoint = {
  bucket: string;
  flagCreates: number;
  reportCreates: number;
  memberJoins: number;
};

type AdminDash = {
  platformSnapshot: PlatformSnapshot;
};

type AnalyticsRes = {
  range: string;
  bucket: string;
  series: SeriesPoint[];
};

type RangeKey = '24h' | '7d' | '30d';

function parseRange(raw: string | undefined): RangeKey {
  if (raw === '7d' || raw === '30d' || raw === '24h') return raw;
  return '24h';
}

function mapSeries(series: SeriesPoint[], bucket: string) {
  const xKey = bucket === 'hour' ? 'hour' : 'label';
  return series.map((p) => {
    const d = new Date(p.bucket);
    const label =
      bucket === 'hour'
        ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return {
      [xKey]: label,
      detections: p.flagCreates + p.reportCreates + p.memberJoins,
      flags: p.flagCreates,
      members: p.memberJoins,
    };
  });
}

function RangeLinks({ range }: { range: RangeKey }) {
  return (
    <div className="border-border bg-surface/50 inline-flex items-center gap-1 rounded-lg border p-1">
      {(['24h', '7d', '30d'] as const).map((r) => (
        <Link
          key={r}
          href={r === '24h' ? '/dashboard/admin/stats' : `/dashboard/admin/stats?range=${r}`}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            range === r ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {r}
        </Link>
      ))}
    </div>
  );
}

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const range = parseRange(sp.range);

  let dash: AdminDash;
  let analytics: AnalyticsRes;
  try {
    [dash, analytics] = await Promise.all([
      dashboardApi<AdminDash>('/admin/dashboard'),
      dashboardApi<AnalyticsRes>(`/admin/analytics/overview?range=${range}`),
    ]);
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Platform snapshot</h1>
        <p className="text-muted-foreground mt-2">
          {e instanceof Error ? e.message : 'Failed to load'} (platform admin only)
        </p>
      </div>
    );
  }

  const stats = dash.platformSnapshot;
  const chartData = mapSeries(analytics.series, analytics.bucket);
  const xKey = analytics.bucket === 'hour' ? 'hour' : 'label';

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Platform snapshot</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Aggregates refreshed by the worker; chart uses audit logs and member first-seen times.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active servers"
          value={stats.guildsActive}
          icon={<Server className="h-5 w-5" />}
        />
        <StatCard
          label="Distinct cached members"
          value={stats.trackedMemberDistinct.toLocaleString()}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Non-clean profiles"
          value={stats.usersFlagged}
          icon={<Flag className="h-5 w-5" />}
        />
        <StatCard
          label="Manual checks"
          value={stats.manualChecksTotal.toLocaleString()}
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Analytics</h2>
        <RangeLinks range={range} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Combined activity</CardTitle>
            <CardDescription>
              Flags + reports + member first-seen per bucket — {analytics.range}
            </CardDescription>
          </div>
        </CardHeader>
        <DetectionsChart data={chartData} xKey={xKey} dataKey="detections" height={260} />
      </Card>

      <p className="text-muted-foreground mt-6 text-[11px]">
        Updated {new Date(stats.updatedAt).toLocaleString()} ·{' '}
        <Link href="/dashboard/admin/guilds" className="text-primary hover:underline">
          Guilds
        </Link>{' '}
        ·{' '}
        <Link href="/dashboard" className="text-primary hover:underline">
          Overview
        </Link>
      </p>
    </>
  );
}
