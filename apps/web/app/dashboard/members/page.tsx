import Link from 'next/link';
import { auth } from '@/auth';
import { dashboardApi } from '@/lib/api-server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { MembersFilter } from '@/app/dashboard/members/members-filter';

type ResolveItem = {
  guildId: string;
  licensed: boolean;
  discordName?: string | null;
};

type ResolveResponse = { items: ResolveItem[] };

type MemberRow = {
  discordUserId: string;
  username: string | null;
  globalName: string | null;
  firstSeenAt: string;
  source: string;
  guildId: string;
  guildLabel: string;
};

type MembersRes = {
  guildId: string;
  items: Array<{
    discordUserId: string;
    username: string | null;
    globalName: string | null;
    firstSeenAt: string;
    source: string;
  }>;
};

export default async function MembersPage() {
  const session = await auth();
  const manageable = session?.manageableGuilds ?? [];
  const ids = manageable.map((g) => g.id);
  const manageableParam = ids.join(',');

  let resolve: ResolveResponse;
  try {
    resolve = await dashboardApi<ResolveResponse>('/me/guilds/resolve', {
      method: 'POST',
      body: JSON.stringify({ guildIds: ids.length ? ids : ['000000000000000000'] }),
    });
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Members</h1>
        <p className="text-muted-foreground mt-2">{e instanceof Error ? e.message : 'Failed to load'}</p>
      </div>
    );
  }

  const filteredResolve = ids.length ? resolve.items.filter((i) => ids.includes(i.guildId)) : [];
  const licensedGuilds = filteredResolve.filter((i) => i.licensed);
  const q = manageableParam ? `?manageable=${encodeURIComponent(manageableParam)}` : '';

  const rows: MemberRow[] = [];
  for (const g of licensedGuilds.slice(0, 12)) {
    try {
      const data = await dashboardApi<MembersRes>(`/me/guilds/${g.guildId}/members${q}`);
      const name =
        manageable.find((m) => m.id === g.guildId)?.name ?? g.discordName ?? g.guildId;
      for (const it of data.items.slice(0, 200)) {
        rows.push({
          ...it,
          guildId: g.guildId,
          guildLabel: name,
        });
      }
    } catch {
      /* skip guild */
    }
  }

  const displayName = (m: MemberRow) =>
    m.globalName?.trim() || m.username?.trim() || m.discordUserId;

  const servers = [
    'All',
    ...new Set(rows.map((r) => r.guildLabel).filter(Boolean)),
  ] as string[];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cached members from licensed servers you manage. For full sync status see{' '}
          <Link href="/dashboard/my-servers" className="text-primary hover:underline">
            My servers
          </Link>
          .
        </p>
      </div>

      <MembersFilter servers={servers}>
        {(server) => {
          const list = server === 'All' ? rows : rows.filter((r) => r.guildLabel === server);
          return (
            <Card className="!p-0 overflow-hidden">
              <Table>
                <Thead>
                  <Tr>
                    <Th />
                    <Th>Name</Th>
                    <Th>ID</Th>
                    <Th>Server</Th>
                    <Th>Source</Th>
                    <Th>First seen</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {list.map((m) => (
                    <Tr key={`${m.guildId}-${m.discordUserId}`}>
                      <Td className="w-10">
                        <Avatar name={displayName(m)} />
                      </Td>
                      <Td className="font-medium">{displayName(m)}</Td>
                      <Td className="font-mono text-[11px] text-muted-foreground">
                        {m.discordUserId}
                      </Td>
                      <Td className="text-muted-foreground">{m.guildLabel}</Td>
                      <Td>
                        <Badge variant="default">{m.source}</Badge>
                      </Td>
                      <Td className="text-muted-foreground text-[11px]">
                        {new Date(m.firstSeenAt).toLocaleString()}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Card>
          );
        }}
      </MembersFilter>

      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No cached members loaded. Ensure you have at least one licensed server with member sync.
        </p>
      ) : null}
    </>
  );
}
