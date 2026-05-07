'use server';

import { revalidatePath } from 'next/cache';
import { dashboardApi } from '@/lib/api-server';

export type SyncMemberSyncState = { ok: true } | { ok: false; error: string };

export async function requestMemberSyncAction(
  _prev: SyncMemberSyncState | null,
  formData: FormData,
): Promise<SyncMemberSyncState> {
  const guildId = formData.get('guildId')?.toString();
  if (!guildId) {
    return { ok: false, error: 'Missing guild id' };
  }
  try {
    await dashboardApi(`/admin/guilds/${guildId}/sync-members`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    revalidatePath('/dashboard/admin/guilds');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Sync request failed',
    };
  }
}

export async function requestMetadataRefreshAction(
  _prev: SyncMemberSyncState | null,
  formData: FormData,
): Promise<SyncMemberSyncState> {
  const guildId = formData.get('guildId')?.toString();
  if (!guildId) {
    return { ok: false, error: 'Missing guild id' };
  }
  try {
    await dashboardApi(`/admin/guilds/${guildId}/refresh-metadata`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    revalidatePath('/dashboard/admin/guilds');
    revalidatePath('/dashboard/admin/licenses');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Refresh request failed',
    };
  }
}
