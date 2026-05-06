import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { dashboardApi } from '@/lib/api-server';

type MeDashboard = {
  reportsPreview: Array<{
    id: string;
    guildId: string | null;
    reason: string;
    status: string;
    createdAt: string;
    targetDiscordId: string;
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
        <h1 className="text-lg font-semibold">My reports</h1>
        <p className="text-muted-foreground mt-2">
          {e instanceof Error ? e.message : 'Failed to load'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Recent reports you submitted (full history may be larger — data from dashboard snapshot).
        </p>
      </div>

      <Card className="!p-0 overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th>Target</Th>
              <Th>Guild</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th>When</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="font-mono text-[11px]">{r.targetDiscordId}</Td>
                <Td className="text-muted-foreground">{r.guildId ?? '—'}</Td>
                <Td>{r.reason}</Td>
                <Td>
                  <Badge variant={variant(r.status)}>{r.status}</Badge>
                </Td>
                <Td className="text-muted-foreground text-[11px]">
                  {new Date(r.createdAt).toLocaleString()}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">No reports in the recent snapshot.</p>
      ) : null}
      <p className="text-muted-foreground mt-4 text-[11px]">
        <Link href="/dashboard" className="text-primary hover:underline">
          Back to overview
        </Link>
      </p>
    </>
  );
}
