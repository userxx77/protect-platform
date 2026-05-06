import Link from 'next/link';
import { auth } from '@/auth';
import { dashboardApi } from '@/lib/api-server';
import { isPlatformAdminDiscordId } from '@/lib/platform-admin';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DetectionsChart } from '@/components/dashboard/DetectionsChart';
import { MiniBarChart } from '@/components/dashboard/MiniBarChart';
import { RangeToggle } from '@/app/dashboard/analytics/range-toggle';

type SeriesPoint = {
  bucket: string;
  flagCreates: number;
  reportCreates: number;
  memberJoins: number;
};

type AnalyticsRes = {
  range: string;
  bucket: string;
  series: SeriesPoint[];
};

type MeDashboard = {
  detectionsLast24h: SeriesPoint[];
};

function mapSeriesForChart(series: SeriesPoint[], xLabel: 'hour' | 'label') {
  return series.map((p) => {
    const d = new Date(p.bucket);
    const label =
      xLabel === 'hour'
        ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return {
      [xLabel]: label,
      detections: p.flagCreates,
      members: p.memberJoins,
      flags: p.flagCreates,
      auto: p.reportCreates,
    };
  });
}

function totalsFromSeries(series: SeriesPoint[]) {
  return series.reduce(
    (acc, p) => ({
      joins: acc.joins + p.memberJoins,
      flags: acc.flags + p.flagCreates,
      reports: acc.reports + p.reportCreates,
    }),
    { joins: 0, flags: 0, reports: 0 },
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  const admin = isPlatformAdminDiscordId(session?.user?.id);
  const sp = await searchParams;
  const raw = sp.range;
  const range =
    raw === '24h' || raw === '7d' || raw === '30d' ? (raw as '24h' | '7d' | '30d') : '7d';

  if (!admin) {
    let me: MeDashboard;
    try {
      me = await dashboardApi<MeDashboard>('/me/dashboard');
    } catch (e) {
      return (
        <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
          <h1 className="text-lg font-semibold">Analytics</h1>
          <p className="text-muted-foreground mt-2">{e instanceof Error ? e.message : 'Failed'}</p>
        </div>
      );
    }
    const chart = mapSeriesForChart(me.detectionsLast24h, 'hour');
    return (
      <>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Last 24h activity from the platform audit log. Platform admins can view 7d / 30d ranges.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Detections</CardTitle>
            <CardDescription>Flags created (24h)</CardDescription>
          </CardHeader>
          <DetectionsChart data={chart} xKey="hour" dataKey="detections" />
        </Card>
      </>
    );
  }

  let analytics: AnalyticsRes;
  try {
    analytics = await dashboardApi<AnalyticsRes>(`/admin/analytics/overview?range=${range}`);
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Analytics</h1>
        <p className="text-muted-foreground mt-2">{e instanceof Error ? e.message : 'Failed'}</p>
      </div>
    );
  }

  const xKey = analytics.bucket === 'hour' ? 'hour' : 'label';
  const det = mapSeriesForChart(analytics.series, xKey);
  const t = totalsFromSeries(analytics.series);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Detection volume and member first-seen from audit logs and cache.
          </p>
        </div>
        <RangeToggle range={range} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Detections</CardTitle>
            <CardDescription>Flag creates ({analytics.range})</CardDescription>
          </CardHeader>
          <DetectionsChart data={det} xKey={xKey} dataKey="detections" />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Member growth</CardTitle>
            <CardDescription>First-seen cache rows over time</CardDescription>
          </CardHeader>
          <DetectionsChart data={det} xKey={xKey} dataKey="members" />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Joins (first seen)</CardTitle>
            <CardDescription>{t.joins.toLocaleString()} in range</CardDescription>
          </CardHeader>
          <MiniBarChart data={det} dataKey="members" xKey={xKey} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Flags</CardTitle>
            <CardDescription>{t.flags.toLocaleString()} in range</CardDescription>
          </CardHeader>
          <MiniBarChart data={det} dataKey="flags" xKey={xKey} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reports (audit)</CardTitle>
            <CardDescription>{t.reports.toLocaleString()} in range</CardDescription>
          </CardHeader>
          <MiniBarChart data={det} dataKey="auto" xKey={xKey} />
        </Card>
      </div>

      <p className="text-muted-foreground mt-6 text-[11px]">
        <Link href="/dashboard/admin/stats" className="text-primary hover:underline">
          Platform snapshot
        </Link>
      </p>
    </>
  );
}
