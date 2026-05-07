import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { dashboardApi } from '@/lib/api-server';
import { reportAvatarSrc, reportMemberLabel, type ReportMemberDisplayDto } from '@/lib/report-display';

type MeDashboard = {
  reportsPreview: Array<{
    id: string;
    guildId: string | null;
    reason: string;
    status: string;
    createdAt: string;
    targetDiscordId: string;
    targetDisplay?: ReportMemberDisplayDto;
  }>;
};

const variant = (s: string) => {
  const u = s.toUpperCase();
  if (u.includes('CONFIRM') || u.includes('APPROV')) return 'destructive' as const;
  if (u.includes('PEND') || u.includes('REVIEW')) return 'warning' as const;
  if (u.includes('REJECT') || u.includes('DISMISS')) return 'muted' as const;
  return 'default' as const;
};

export default async function MyReportsPage() {
  let rows: MeDashboard['reportsPreview'];
  try {
    const data = await dashboardApi<MeDashboard>('/me/dashboard');
    rows = data.reportsPreview;
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Mijn meldingen</h1>
        <p className="text-muted-foreground mt-2">
          {e instanceof Error ? e.message : 'Laden mislukt'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Mijn meldingen</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Meldingen die je via Discord hebt ingediend. Tik op een rij voor de volledige tekst en status.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const src = reportAvatarSrc(r.targetDisplay ?? null, r.targetDiscordId);
          const name = reportMemberLabel(r.targetDisplay ?? null, r.targetDiscordId);
          return (
            <li key={r.id}>
              <Link href={`/dashboard/reports/${r.id}`}>
                <Card className="hover:border-primary/40 flex gap-3 !p-3 transition-colors">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    width={40}
                    height={40}
                    className="border-border h-10 w-10 shrink-0 rounded-full border"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{name}</span>
                      <Badge variant={variant(r.status)}>{r.status}</Badge>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-sm">{r.reason}</p>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {new Date(r.createdAt).toLocaleString('nl-NL')}
                      {r.guildId ? ` · server` : ''}
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">Nog geen meldingen in dit overzicht.</p>
      ) : null}
      <p className="text-muted-foreground mt-4 text-[11px]">
        <Link href="/dashboard" className="text-primary hover:underline">
          ← Terug naar home
        </Link>
      </p>
    </>
  );
}
