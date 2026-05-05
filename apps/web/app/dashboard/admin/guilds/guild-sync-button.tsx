'use client';

import { useActionState } from 'react';
import { requestMemberSyncAction, type SyncMemberSyncState } from './actions';

export function GuildSyncButton({ guildId }: { guildId: string }) {
  const [state, formAction, isPending] = useActionState<
    SyncMemberSyncState | null,
    FormData
  >(requestMemberSyncAction, null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <form action={formAction} style={{ margin: 0 }}>
        <input type="hidden" name="guildId" value={guildId} />
        <button
          type="submit"
          disabled={isPending}
          className="ds-btn ds-btn-ghost"
          style={{ fontSize: '0.85rem' }}
        >
          {isPending ? 'Queuing…' : 'Sync now'}
        </button>
      </form>
      {state?.ok === false ? (
        <span className="ds-alert ds-alert-error" style={{ fontSize: '0.8rem' }}>
          {state.error}
        </span>
      ) : null}
      {state?.ok === true ? (
        <span className="ds-hint" style={{ fontSize: '0.8rem' }}>
          Sync queued. Status updates when the bot finishes.
        </span>
      ) : null}
    </div>
  );
}
