'use client';

import { useActionState } from 'react';
import { requestMetadataRefreshAction, type SyncMemberSyncState } from './actions';
import { Button } from '@/components/ui/button';

export function GuildMetadataRefreshButton({ guildId }: { guildId: string }) {
  const [state, formAction, isPending] = useActionState<
    SyncMemberSyncState | null,
    FormData
  >(requestMetadataRefreshAction, null);

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction} className="m-0">
        <input type="hidden" name="guildId" value={guildId} />
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? 'Queuing…' : 'Refresh Discord info'}
        </Button>
      </form>
      {state?.ok === false ? (
        <span className="text-destructive text-[11px]">{state.error}</span>
      ) : null}
      {state?.ok === true ? (
        <span className="text-muted-foreground text-[11px]">
          Bot will update server name, icon, and owner when online (requires Redis).
        </span>
      ) : null}
    </div>
  );
}
