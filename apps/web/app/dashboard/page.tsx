import Link from 'next/link';
import {
  Activity,
  Users,
  Server,
  ShieldCheck,
  Flag,
  UserPlus,
  Bot,
} from 'lucide-react';
import { auth } from '@/auth';
import { dashboardApi } from '@/lib/api-server';
import { isPlatformAdminDiscordId } from '@/lib/platform-admin';
import { StatCard } from '@/components/dashboard/StatCard';
import { DetectionsChart } from '@/components/dashboard/DetectionsChart';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

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

const iconFor = (k: string) => {
  switch (k) {
    case 'detection':
      return <Flag className="h-3.5 w-3.5 text-[oklch(0.88_0.16_75)]" />;
    case 'join':
      return <UserPlus className="text-[oklch(0.85_0.18_155)] h-3.5 w-3.5" />;
    case 'auto':
      return <Bot className="text-primary h-3.5 w-3.5" />;
    case 'report':
      return <ShieldCheck className="h-3.5 w-3.5 text-[oklch(0.82_0.22_25)]" />;
    default:
      return <Activity className="h-3.5 w-3.5" />;
  }
};

function activityKind(action: string): string {
  const a = action.toUpperCase();
  if (a.includes('FLAG')) return 'detection';
  if (a.includes('REPORT')) return 'report';
  if (a.includes('GUILD') || a.includes('TRUST') || a.includes('USER_TOUCH')) return 'join';
  if (a.includes('BOT') || a.includes('OUTBOX')) return 'auto';
  return 'default';
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
            title="Overview"
            sub="Detections, platform snapshot tickets, and non-clean profiles."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Detections today"
              value={data.detectionsToday.toLocaleString()}
              icon={<Flag className="h-5 w-5" />}
            />
            <StatCard
              label="Users monitored"
              value={snap.trackedMemberDistinct.toLocaleString()}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Discords protected"
              value={snap.guildsActive.toLocaleString()}
              icon={<Server className="h-5 w-5" />}
            />
            <StatCard
              label="Reports pending"
              value={data.reportsPending.toLocaleString()}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </div>
          <div className="text-muted-foreground mt-3 text-[11px]">
            Tickets — open / pending / closed:{' '}
            <span className="text-foreground font-medium">
              {data.ticketBuckets.open} · {data.ticketBuckets.pending} · {data.ticketBuckets.closed}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Detections — last 24h</CardTitle>
                  <CardDescription>
                    Flag creates from audit log (hourly buckets)
                  </CardDescription>
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
                  <CardDescription>Latest audit events</CardDescription>
                </div>
              </CardHeader>
              <ul className="space-y-2.5">
                {data.recentActivity.slice(0, 8).map((r) => {
                  const kind = activityKind(r.action);
                  return (
                    <li
                      key={r.id}
                      className="border-border/60 bg-surface/40 flex items-start gap-3 rounded-md border p-2.5"
                    >
                      <div className="bg-surface-2 grid h-7 w-7 place-items-center rounded-md">
                        {iconFor(kind)}
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-[12.5px]">
                          <span className="font-medium">{r.action}</span>{' '}
                          <span className="text-muted-foreground">{r.entityType}</span>
                        </div>
                        <div className="text-muted-foreground mt-0.5 text-[10.5px]">
                          {r.targetId ?? r.entityId} · {new Date(r.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Flagged users</h2>
              <Button variant="soft" size="sm" asChild>
                <Link href="/dashboard/admin/tickets">Admin tickets</Link>
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
                          <Link href={`/dashboard/admin/users/${u.discordId}`}>Flags</Link>
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Card>
            {data.flaggedPreview.items.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">No non-clean users in preview.</p>
            ) : null}
          </div>

          <p className="text-muted-foreground mt-6 text-[11px]">
            Snapshot updated {new Date(snap.updatedAt).toLocaleString()}
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
          title="Overview"
          sub="Your Sentra snapshot — detections, tickets, and recent activity."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Detections today"
            value={data.detectionsToday.toLocaleString()}
            icon={<Flag className="h-5 w-5" />}
          />
          <StatCard
            label="Users monitored"
            value={snap.trackedMemberDistinct.toLocaleString()}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="Discords protected"
            value={snap.guildsActive.toLocaleString()}
            icon={<Server className="h-5 w-5" />}
          />
        </div>
        <div className="text-muted-foreground mt-3 text-[11px]">
          My tickets — open / pending / closed:{' '}
          <span className="text-foreground font-medium">
            {data.ticketBuckets.open} · {data.ticketBuckets.pending} · {data.ticketBuckets.closed}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Detections — last 24h</CardTitle>
                <CardDescription>Platform flag volume from audit log</CardDescription>
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
                <CardDescription>Latest platform events</CardDescription>
              </div>
            </CardHeader>
            <ul className="space-y-2.5">
              {data.recentActivity.slice(0, 8).map((r) => {
                const kind = activityKind(r.action);
                return (
                  <li
                    key={r.id}
                    className="border-border/60 bg-surface/40 flex items-start gap-3 rounded-md border p-2.5"
                  >
                    <div className="bg-surface-2 grid h-7 w-7 place-items-center rounded-md">
                      {iconFor(kind)}
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-[12.5px]">
                        <span className="font-medium">{r.action}</span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-[10.5px]">
                        {new Date(r.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

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
              <CardDescription>Recent submissions</CardDescription>
            </CardHeader>
            <ul className="space-y-2">
              {data.reportsPreview.map((r) => (
                <li
                  key={r.id}
                  className="border-border/60 flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="font-mono text-[11px] text-muted-foreground">{r.targetDiscordId}</div>
                  <div className="truncate">{r.reason}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {r.status} · {new Date(r.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
            {data.reportsPreview.length === 0 ? (
              <p className="text-muted-foreground px-1 pb-3 text-sm">No reports yet.</p>
            ) : null}
          </Card>
        </div>

        <p className="text-muted-foreground mt-6 text-[11px]">
          Snapshot updated {new Date(snap.updatedAt).toLocaleString()}
        </p>
      </>
    );
  } catch (e) {
    return (
      <Card className="border-destructive/40">
        <PageHeader title="Overview" sub="Could not load dashboard data." />
        <p className="text-destructive text-sm">
          {e instanceof Error ? e.message : 'Unknown error'}. Check{' '}
          <code className="font-mono text-xs">ADMIN_DISCORD_IDS</code> and JWT configuration.
        </p>
      </Card>
    );
  }
}
