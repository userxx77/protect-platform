'use server';

import { revalidatePath } from 'next/cache';
import { dashboardApi } from '@/lib/api-server';

export async function deleteFlagAction(discordId: string, flagId: string): Promise<void> {
  await dashboardApi(`/admin/users/${discordId}/flags/${flagId}`, {
    method: 'DELETE',
  });
  revalidatePath(`/dashboard/admin/users/${discordId}`);
}

export async function patchFlagAction(
  discordId: string,
  flagId: string,
  formData: FormData,
): Promise<void> {
  const reason = String(formData.get('reason') ?? '').trim();
  const weightRaw = String(formData.get('weight') ?? '').trim();
  const body: { reason?: string; weight?: number } = {};
  if (reason) body.reason = reason;
  if (weightRaw) {
    const w = Number(weightRaw);
    if (Number.isFinite(w)) body.weight = w;
  }
  await dashboardApi(`/admin/users/${discordId}/flags/${flagId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  revalidatePath(`/dashboard/admin/users/${discordId}`);
}
