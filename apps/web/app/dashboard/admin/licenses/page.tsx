import { dashboardApi } from '@/lib/api-server';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LicenseKeysPanel } from './license-keys-panel';

type EntRow = {
  guildId: string;
  discordName: string | null;
  approximateMemberCount: number | null;
  ownerDiscordId: string | null;
  entitlement: {
    status: string;
    validFrom: string;
    validUntil: string | null;
    planCode: string | null;
  } | null;
};

type KeyRow = {
  id: string;
  code: string;
  status: string;
  planCode: string | null;
  presetValidDays: number | null;
  createdAt: string;
  redeemedGuildId: string | null;
};

export default async function AdminLicensesPage() {
  let rows: EntRow[];
  let keys: KeyRow[];
  try {
    [rows, keys] = await Promise.all([
      dashboardApi<EntRow[]>('/admin/guilds'),
      dashboardApi<{ items: KeyRow[] }>('/admin/license-keys').then((r) =>
        Array.isArray(r.items) ? r.items : [],
      ),
    ]);
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Licenses</h1>
        <p className="text-muted-foreground mt-2">
          {e instanceof Error ? e.message : 'Failed to load'} (platform admin only)
        </p>
      </div>
    );
  }

  const licensed = rows.filter((r) => r.entitlement);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Licenses</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Redeemable keys (e.g. <code className="text-xs">sentra-ab12cd34</code>) and active server
          subscriptions. Users redeem under{' '}
          <Link href="/dashboard/server-setup" className="text-primary hover:underline">
            Server setup
          </Link>
          .
        </p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">License keys</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>
        <TabsContent value="keys">
          <LicenseKeysPanel initialItems={keys} />
        </TabsContent>
        <TabsContent value="subscriptions">
          <Card className="!p-0 overflow-hidden">
            <Table>
              <Thead>
                <Tr>
                  <Th />
                  <Th>Server</Th>
                  <Th>Guild ID</Th>
                  <Th>Owner ID</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th>Valid from</Th>
                  <Th>Valid until</Th>
                  <Th>Members</Th>
                </Tr>
              </Thead>
              <Tbody>
                {licensed.map((r) => (
                  <Tr key={r.guildId}>
                    <Td className="w-10">
                      <Avatar name={r.discordName ?? r.guildId} />
                    </Td>
                    <Td className="font-medium">{r.discordName ?? '—'}</Td>
                    <Td className="font-mono text-[11px] text-muted-foreground">{r.guildId}</Td>
                    <Td className="font-mono text-[11px] text-muted-foreground">
                      {r.ownerDiscordId ?? '—'}
                    </Td>
                    <Td>{r.entitlement?.planCode ?? '—'}</Td>
                    <Td>
                      <Badge variant="primary">{r.entitlement?.status ?? '—'}</Badge>
                    </Td>
                    <Td className="text-muted-foreground text-[11px]">
                      {r.entitlement?.validFrom
                        ? new Date(r.entitlement.validFrom).toLocaleDateString()
                        : '—'}
                    </Td>
                    <Td className="text-muted-foreground text-[11px]">
                      {r.entitlement?.validUntil
                        ? new Date(r.entitlement.validUntil).toLocaleDateString()
                        : '—'}
                    </Td>
                    <Td>{r.approximateMemberCount ?? '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
          {licensed.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">No entitlement records yet.</p>
          ) : null}
        </TabsContent>
      </Tabs>
    </>
  );
}
