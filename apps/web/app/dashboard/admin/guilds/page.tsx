import { dashboardApi } from '@/lib/api-server';
import Link from 'next/link';
import { guildIconUrl } from '@/lib/discord-cdn';
import { GuildSyncButton } from './guild-sync-button';
import { Card } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

type EntRow = {
  guildId: string;
  discordName: string | null;
  iconHash: string | null;
  approximateMemberCount: number | null;
  ownerDiscordId: string | null;
  vanityUrlCode: string | null;
  premiumTier: number | null;
  botJoinedAt: string | null;
  removedAt: string | null;
  updatedAt: string;
  entitlement: {
    status: string;
    validFrom: string;
    validUntil: string | null;
    planCode: string | null;
    memberSyncState: string;
    lastMemberSyncAt: string | null;
  } | null;
};

export default async function AdminGuildsPage() {
  let rows: EntRow[];
  try {
    rows = await dashboardApi<EntRow[]>('/admin/guilds');
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Guilds</h1>
        <p className="text-muted-foreground mt-2">
          {e instanceof Error ? e.message : 'Failed to load'} (platform admin only)
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Guilds</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Entitlements and member sync. Use <strong>Sync now</strong> to queue a cache refresh.
        </p>
      </div>

      <Card className="!p-0 overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th />
              <Th>Name</Th>
              <Th>Guild ID</Th>
              <Th>Owner</Th>
              <Th>License</Th>
              <Th>Valid until</Th>
              <Th>Sync state</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => {
              const ic = guildIconUrl(r.guildId, r.iconHash);
              return (
                <Tr key={r.guildId}>
                  <Td className="w-12">
                    {ic ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ic} alt="" width={36} height={36} className="rounded-lg" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="font-medium">{r.discordName ?? '—'}</span>
                    {r.vanityUrlCode ? (
                      <span className="text-muted-foreground mt-0.5 block text-[11px]">
                        .gg/{r.vanityUrlCode}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="font-mono text-[11px] text-muted-foreground">{r.guildId}</Td>
                  <Td className="font-mono text-[11px] text-muted-foreground">
                    {r.ownerDiscordId ?? '—'}
                  </Td>
                  <Td>{r.entitlement?.status ?? '—'}</Td>
                  <Td className="font-mono text-[11px] text-muted-foreground">
                    {r.entitlement?.validUntil ?? '—'}
                  </Td>
                  <Td className="text-[11px]">{r.entitlement?.memberSyncState ?? '—'}</Td>
                  <Td>
                    <GuildSyncButton guildId={r.guildId} />
                    <Button variant="ghost" size="sm" className="mt-1 h-auto px-0" asChild>
                      <Link href={`/dashboard/my-servers/${r.guildId}`}>View cache</Link>
                    </Button>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>
      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">No guilds recorded yet.</p>
      ) : null}
    </>
  );
}
