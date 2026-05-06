import Link from 'next/link';
import { dashboardApi } from '@/lib/api-server';
import { patchTicketAction, resolveTicketAction } from './actions';
import { Card } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FlagLevelBadge } from '@/components/flag-level-badge';

type TicketRow = {
  id: string;
  status: string;
  reportId: string;
  guildId: string | null;
  reporterDiscordId: string;
  createdAt: string;
  updatedAt: string;
  targetDiscordId: string;
  reportStatus: string;
  reportReason?: string;
  allegedFlagLevel?: string | null;
  adminNote: string | null;
};

type AdminDashTickets = {
  tickets: { items: TicketRow[] };
  ticketBuckets: { open: number; pending: number; closed: number };
};

export default async function AdminTicketsPage() {
  let data: AdminDashTickets;
  try {
    data = await dashboardApi<AdminDashTickets>('/admin/dashboard');
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Tickets</h1>
        <p className="text-muted-foreground mt-2">{e instanceof Error ? e.message : 'Failed to load'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Support tickets</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Evidence workflow. Open / pending / closed:{' '}
          <span className="text-foreground font-medium">
            {data.ticketBuckets.open} · {data.ticketBuckets.pending} · {data.ticketBuckets.closed}
          </span>
        </p>
      </div>

      <Card className="!p-0 overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th>Severity</Th>
              <Th>Updated</Th>
              <Th>Status</Th>
              <Th>Target</Th>
              <Th>Reporter</Th>
              <Th>Report</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.tickets.items.map((t) => (
              <Tr key={t.id}>
                <Td>
                  <FlagLevelBadge level={t.allegedFlagLevel} />
                </Td>
                <Td className="font-mono text-[11px] text-muted-foreground">{t.updatedAt}</Td>
                <Td>{t.status}</Td>
                <Td className="font-mono text-[11px]">{t.targetDiscordId}</Td>
                <Td className="font-mono text-[11px]">{t.reporterDiscordId}</Td>
                <Td className="font-mono text-[11px]">{t.reportStatus}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <form action={patchTicketAction.bind(null, t.id, 'NEEDS_EVIDENCE')}>
                      <Button type="submit" variant="outline" size="sm" title="Ask reporter for evidence">
                        Request evidence
                      </Button>
                    </form>
                    <form action={patchTicketAction.bind(null, t.id, 'UNDER_REVIEW')}>
                      <Button type="submit" variant="outline" size="sm">
                        Mark reviewing
                      </Button>
                    </form>
                    {t.reportStatus === 'PENDING' ? (
                      <form action={resolveTicketAction.bind(null, t.id)}>
                        <Button type="submit" size="sm">
                          Approve report
                        </Button>
                      </form>
                    ) : null}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/admin/users/${t.targetDiscordId}`}>User flags</Link>
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
      {data.tickets.items.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">No tickets.</p>
      ) : null}
    </>
  );
}
