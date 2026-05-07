import { dashboardApi } from '@/lib/api-server';
import Link from 'next/link';
import { guildIconUrl } from '@/lib/discord-cdn';
import { GuildSyncButton } from './guild-sync-button';
import { GuildMetadataRefreshButton } from './guild-metadata-refresh-button';
import { Card } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

function syncBadgeVariant(state: string | undefined): 'primary' | 'default' {
  if (state === 'QUEUED' || state === 'RUNNING') return 'primary';
  return 'default';
}

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
          Entitlements and member cache sync. <strong>Sync now</strong> queues a full member refresh;
          <strong> Refresh Discord info</strong> asks the bot to update name, icon, and owner (needs bot +
          Redis).
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
              <Th>Member sync</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => {
              const ic = guildIconUrl(r.guildId, r.iconHash);
              const validUntil =
                r.entitlement?.validUntil != null
                  ? new Date(r.entitlement.validUntil).toLocaleDateString()
                  : '—';
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
                    {r.ownerDiscordId ? (
                      <Link
                        className="text-primary hover:underline"
                        href={`https://discord.com/users/${r.ownerDiscordId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.ownerDiscordId}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>{r.entitlement?.status ?? '—'}</Td>
                  <Td className="text-[11px] text-muted-foreground">{validUntil}</Td>
                  <Td>
                    <Badge variant={syncBadgeVariant(r.entitlement?.memberSyncState)}>
                      {r.entitlement?.memberSyncState ?? '—'}
                    </Badge>
                  </Td>
                  <Td className="align-top">
                    <div className="flex flex-col gap-2">
                      <GuildSyncButton guildId={r.guildId} />
                      <GuildMetadataRefreshButton guildId={r.guildId} />
                      <Button variant="ghost" size="sm" className="h-auto justify-start px-0" asChild>
                        <Link href={`/dashboard/my-servers/${r.guildId}`}>View member cache</Link>
                      </Button>
                    </div>
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
