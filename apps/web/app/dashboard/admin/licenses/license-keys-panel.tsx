'use client';

import { useActionState } from 'react';
import { generateLicenseKeysAction, revokeLicenseKeyAction, type GenKeyState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type KeyRow = {
  id: string;
  code: string;
  status: string;
  planCode: string | null;
  presetValidDays: number | null;
  createdAt: string;
  redeemedGuildId: string | null;
};

export function LicenseKeysPanel({ initialItems }: { initialItems: KeyRow[] }) {
  const [genState, genAction, genPending] = useActionState<GenKeyState | null, FormData>(
    generateLicenseKeysAction,
    null,
  );

  return (
    <div className="space-y-6">
      <form action={genAction} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Count</label>
          <Input type="number" name="count" min={1} max={100} defaultValue={5} className="w-24" />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Plan code (optional)</label>
          <Input name="planCode" placeholder="pro" className="w-32" />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Valid days (optional)</label>
          <Input type="number" name="presetValidDays" placeholder="30" className="w-28" />
        </div>
        <Button type="submit" disabled={genPending}>
          {genPending ? 'Generating…' : 'Generate keys'}
        </Button>
      </form>
      {genState?.ok === false ? (
        <p className="text-destructive text-sm">{genState.error}</p>
      ) : null}
      {genState?.ok === true && genState.keys.length > 0 ? (
        <div className="bg-primary-soft/15 rounded-lg border border-primary/25 p-3 text-sm">
          <p className="font-medium">New keys (copy now)</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {genState.keys.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <Thead>
            <Tr>
              <Th>Code</Th>
              <Th>Status</Th>
              <Th>Plan</Th>
              <Th>Days</Th>
              <Th>Redeemed guild</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {initialItems.map((k) => (
              <Tr key={k.id}>
                <Td className="font-mono text-xs">{k.code}</Td>
                <Td>
                  <Badge variant={k.status === 'UNUSED' ? 'muted' : 'primary'}>{k.status}</Badge>
                </Td>
                <Td>{k.planCode ?? '—'}</Td>
                <Td>{k.presetValidDays ?? '—'}</Td>
                <Td className="font-mono text-[11px]">{k.redeemedGuildId ?? '—'}</Td>
                <Td>
                  {k.status === 'UNUSED' ? (
                    <form action={revokeLicenseKeyAction}>
                      <input type="hidden" name="id" value={k.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Revoke
                      </Button>
                    </form>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
