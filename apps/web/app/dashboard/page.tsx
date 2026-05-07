import Link from 'next/link';
import {
  Users,
  Server,
  ShieldCheck,
  Flag,
} from 'lucide-react';
import { auth } from '@/auth';
import { dashboardApi } from '@/lib/api-server';
import { isPlatformAdminDiscordId } from '@/lib/platform-admin';
import { StatCard } from '@/components/dashboard/StatCard';
import { DetectionsChart } from '@/components/dashboard/DetectionsChart';
import { LiveActivityFeed } from '@/components/dashboard/LiveActivityFeed';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { reportAvatarSrc, reportMemberLabel } from '@/lib/report-display';

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

type ActivityItem = {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  targetId: string | null;
  actorDiscordId: string | null;
};

type MeDashboard = {
  platformSnapshot: PlatformSnapshot;
  ticketBuckets: { open: number; pending: number; closed: number };
  ticketsPreview: Array<{
    id: string;
    status: string;
    reportId: string;
    targetDiscordId: string;
    reportReason: string;
    updatedAt: string;
  }>;
  reportsPreview: Array<{
    id: string;
    guildId: string | null;
    reason: string;
    status: string;
    createdAt: string;
    targetDiscordId: string;
    targetDisplay?: {
      discordUserId: string;
      username: string | null;
      globalName: string | null;
      avatarHash: string | null;
    } | null;
  }>;
  recentActivity: ActivityItem[];
  detectionsToday: number;
  detectionsLast24h: SeriesPoint[];
};

type FlaggedItem = {
  discordId: string;
  flagLevel: string;
  flagScore: number;
  flagCount?: number;
  updatedAt: string;
};

type AdminDashboard = {
  platformSnapshot: PlatformSnapshot;
  ticketBuckets: { open: number; pending: number; closed: number };
  reportsPending: number;
  recentActivity: ActivityItem[];
  detectionsToday: number;
  detectionsLast24h: SeriesPoint[];
  flaggedPreview: { items: FlaggedItem[] };
};

function PageHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{sub}</p>
    </div>
  );
}

function seriesToChart(series: SeriesPoint[]) {
  return series.map((p) => ({
    hour: new Date(p.bucket).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }),
    detections: p.flagCreates,
    total: p.flagCreates + p.reportCreates + p.memberJoins,
  }));
}

export default async function DashboardOverviewPage() {
  const session = await auth();
  const showAdmin = isPlatformAdminDiscordId(session?.user?.id);

  try {
    if (showAdmin) {
      const data = await dashboardApi<AdminDashboard>('/admin/dashboard');
      const snap = data.platformSnapshot;
      const chartData = seriesToChart(data.detectionsLast24h);
      return (
        <>
          <PageHeader
            title="Home"
            sub="Platform overview: pending reports, tickets, and flagged profiles."
          />
          {data.reportsPending > 0 ? (
            <div className="border-primary/40 bg-primary-soft/15 mb-6 rounded-xl border px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {data.reportsPending} report{data.reportsPending !== 1 ? 's' : ''} awaiting review
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Open the queue, read the reason, then reject or approve with the right tier.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/dashboard/admin/reports">Open reports</Link>
                </Button>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Flag events today"
              value={data.detectionsToday.toLocaleString()}
              icon={<Flag className="h-5 w-5" />}
            />
            <StatCard
              label="Users monitored"
              value={snap.trackedMemberDistinct.toLocaleString()}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Active servers"
              value={snap.guildsActive.toLocaleString()}
              icon={<Server className="h-5 w-5" />}
            />
            <StatCard
              label="Open reports"
              value={data.reportsPending.toLocaleString()}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </div>
          <div className="text-muted-foreground mt-3 text-[11px]">
            Support tickets — open / in progress / closed:{' '}
            <span className="text-foreground font-medium">
              {data.ticketBuckets.open} · {data.ticketBuckets.pending} · {data.ticketBuckets.closed}
            </span>
          </div>

          <details className="mt-6 group">
            <summary className="text-muted-foreground cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Show charts and audit feed</span>
              <span className="hidden group-open:inline">Hide charts and audit feed</span>
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Activity — last 24 hours</CardTitle>
                  <CardDescription>New flag changes (from audit log, hourly)</CardDescription>
                </div>
                <div className="border-border bg-surface/40 flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] text-muted-foreground">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-primary" />
                  live
                </div>
              </CardHeader>
              <DetectionsChart data={chartData} dataKey="detections" xKey="hour" />
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Recent events</CardTitle>
                  <CardDescription>Latest audit events</CardDescription>
                </div>
              </CardHeader>
              <LiveActivityFeed initial={data.recentActivity} variant="admin" />
            </Card>
          </div>
          </details>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Flagged profiles</h2>
              <Button variant="soft" size="sm" asChild>
                <Link href="/dashboard/admin/tickets">Support tickets</Link>
              </Button>
            </div>
            <Card className="!p-0 overflow-hidden">
              <Table>
                <Thead>
                  <Tr>
                    <Th>User</Th>
                    <Th>Level</Th>
                    <Th>Score</Th>
                    <Th>Flags</Th>
                    <Th>Updated</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {data.flaggedPreview.items.map((u) => (
                    <Tr key={u.discordId}>
                      <Td className="font-mono text-[11px]">{u.discordId}</Td>
                      <Td>
                        <Badge variant="warning">{u.flagLevel}</Badge>
                      </Td>
                      <Td>{u.flagScore}</Td>
                      <Td>{u.flagCount ?? '—'}</Td>
                      <Td className="text-muted-foreground text-[11px]">{u.updatedAt}</Td>
                      <Td>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/admin/users/${u.discordId}`}>View</Link>
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Card>
            {data.flaggedPreview.items.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                No flagged users in this list.
              </p>
            ) : null}
          </div>

          <p className="text-muted-foreground mt-6 text-[11px]">
            Last updated {new Date(snap.updatedAt).toLocaleString()}
          </p>
        </>
      );
    }

    const data = await dashboardApi<MeDashboard>('/me/dashboard');
    const snap = data.platformSnapshot;
    const chartData = seriesToChart(data.detectionsLast24h);

    return (
      <>
        <PageHeader
          title="Home"
          sub="Your tickets and reports, plus a short platform snapshot. New? Open the welcome guide in the sidebar."
        />
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/welcome">Welcome guide</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/server-setup">Server setup</Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Flag events today"
            value={data.detectionsToday.toLocaleString()}
            icon={<Flag className="h-5 w-5" />}
          />
          <StatCard
            label="Users monitored"
            value={snap.trackedMemberDistinct.toLocaleString()}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="Active servers"
            value={snap.guildsActive.toLocaleString()}
            icon={<Server className="h-5 w-5" />}
          />
        </div>
        <div className="text-muted-foreground mt-3 text-[11px]">
          Your tickets — open / in progress / closed:{' '}
          <span className="text-foreground font-medium">
            {data.ticketBuckets.open} · {data.ticketBuckets.pending} · {data.ticketBuckets.closed}
          </span>
        </div>

        <details className="mt-6 group">
          <summary className="text-muted-foreground cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show platform chart and recent activity</span>
            <span className="hidden group-open:inline">Hide platform chart</span>
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Activity — last 24 hours</CardTitle>
                <CardDescription>Flag volume at platform level</CardDescription>
              </div>
              <div className="border-border bg-surface/40 flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] text-muted-foreground">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-primary" />
                live
              </div>
            </CardHeader>
            <DetectionsChart data={chartData} dataKey="detections" xKey="hour" />
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Latest events</CardDescription>
              </div>
            </CardHeader>
            <LiveActivityFeed initial={data.recentActivity} variant="user" />
          </Card>
        </div>
        </details>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>My tickets</CardTitle>
              <CardDescription>
                <Link href="/dashboard/tickets" className="text-primary text-xs hover:underline">
                  View all
                </Link>
              </CardDescription>
            </CardHeader>
            <ul className="space-y-2">
              {data.ticketsPreview.map((t) => (
                <li
                  key={t.id}
                  className="border-border/60 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 truncate">
                    <span className="text-muted-foreground font-mono text-[11px]">{t.status}</span>{' '}
                    {t.reportReason}
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/tickets/${t.id}`}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
            {data.ticketsPreview.length === 0 ? (
              <p className="text-muted-foreground px-1 pb-3 text-sm">No tickets yet.</p>
            ) : null}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>My reports</CardTitle>
              <CardDescription>Latest submitted reports</CardDescription>
            </CardHeader>
            <ul className="space-y-2">
              {data.reportsPreview.map((r) => {
                const src = reportAvatarSrc(r.targetDisplay ?? null, r.targetDiscordId);
                const name = reportMemberLabel(r.targetDisplay ?? null, r.targetDiscordId);
                return (
                <li key={r.id}>
                  <Link
                    href={`/dashboard/reports/${r.id}`}
                    className="border-border/60 hover:bg-surface/30 flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{name}</div>
                      <div className="truncate text-xs opacity-90">{r.reason}</div>
                      <div className="text-muted-foreground text-[11px]">
                        {r.status} · {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </Link>
                </li>
              );
              })}
            </ul>
            {data.reportsPreview.length === 0 ? (
              <p className="text-muted-foreground px-1 pb-3 text-sm">No reports yet.</p>
            ) : null}
          </Card>
        </div>

        <p className="text-muted-foreground mt-6 text-[11px]">
          Platform figures updated {new Date(snap.updatedAt).toLocaleString()}
        </p>
      </>
    );
  } catch (e) {
    return (
      <Card className="border-destructive/40">
        <PageHeader title="Home" sub="Could not load dashboard." />
        <p className="text-destructive text-sm">
          {e instanceof Error ? e.message : 'Unknown error'}. Check your permissions and API
          connectivity.
        </p>
      </Card>
    );
  }
}
