import Link from 'next/link';
import { auth } from '@/auth';
import { dashboardApi } from '@/lib/api-server';
import {
  MembersViewClient,
  type MembersViewRow,
} from '@/app/dashboard/members/members-view-client';

type ResolveItem = {
  guildId: string;
  licensed: boolean;
  discordName?: string | null;
};

type ResolveResponse = { items: ResolveItem[] };

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
  try {
    const session = await auth();
    const manageable = session?.manageableGuilds ?? [];
    const ids = manageable.map((g) => g.id);
    const manageableParam = ids.join(',');

    const resolve = await dashboardApi<ResolveResponse>('/me/guilds/resolve', {
      method: 'POST',
      body: JSON.stringify({ guildIds: ids.length ? ids : ['000000000000000000'] }),
    });

    if (!resolve?.items || !Array.isArray(resolve.items)) {
      throw new Error('Invalid resolve response from API');
    }

    const filteredResolve = ids.length ? resolve.items.filter((i) => ids.includes(i.guildId)) : [];
    const licensedGuilds = filteredResolve.filter((i) => i.licensed);
    const baseQ = manageableParam ? `manageable=${encodeURIComponent(manageableParam)}` : '';
    const memberListQ = baseQ ? `${baseQ}&take=500` : 'take=500';

    const rows: MembersViewRow[] = [];
    for (const g of licensedGuilds.slice(0, 12)) {
      try {
        const q = `?${memberListQ}`;
        const data = await dashboardApi<MembersRes>(`/me/guilds/${g.guildId}/members${q}`);
        if (!data?.items) continue;
        const name =
          manageable.find((m) => m.id === g.guildId)?.name ?? g.discordName ?? g.guildId;
        for (const it of data.items) {
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

        {rows.length > 0 ? (
          <MembersViewClient servers={servers} rows={rows} />
        ) : (
          <p className="text-muted-foreground mt-4 text-sm">
            No cached members loaded. Ensure you have at least one licensed server with member sync.
          </p>
        )}
      </>
    );
  } catch (e) {
    return (
      <div className="border-destructive/35 bg-destructive/10 rounded-lg border p-6 text-sm">
        <h1 className="text-lg font-semibold">Members</h1>
        <p className="text-muted-foreground mt-2">{e instanceof Error ? e.message : 'Failed to load'}</p>
      </div>
    );
  }
}
