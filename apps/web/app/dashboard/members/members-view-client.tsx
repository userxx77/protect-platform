'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export type MembersViewRow = {
  discordUserId: string;
  username: string | null;
  globalName: string | null;
  firstSeenAt: string;
  source: string;
  guildId: string;
  guildLabel: string;
};

const PAGE_SIZE = 10;

function displayName(m: MembersViewRow) {
  return m.globalName?.trim() || m.username?.trim() || m.discordUserId;
}

export function MembersViewClient({
  servers,
  rows,
}: {
  servers: string[];
  rows: MembersViewRow[];
}) {
  const [server, setServer] = useState(servers[0] ?? 'All');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return server === 'All' ? rows : rows.filter((r) => r.guildLabel === server);
  }, [rows, server]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageSlice = useMemo(() => {
    const p = safePage;
    const start = (p - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const onServerChange = (s: string) => {
    setServer(s);
    setPage(1);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {servers.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onServerChange(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              server === s
                ? 'border-primary/40 bg-primary-soft text-primary'
                : 'border-border bg-surface/40 text-muted-foreground hover:text-foreground',
            )}
          >
            {s}
          </button>
        ))}
      </div>

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
            {pageSlice.map((m) => (
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

      {filtered.length > PAGE_SIZE ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {safePage} of {totalPages} ({filtered.length} members)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
