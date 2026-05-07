'use server';

import { revalidatePath } from 'next/cache';
import { dashboardApi } from '@/lib/api-server';

export type GenKeyState = { ok: true; keys: string[] } | { ok: false; error: string };

export async function generateLicenseKeysAction(
  _prev: GenKeyState | null,
  formData: FormData,
): Promise<GenKeyState> {
  const count = Number(formData.get('count') ?? 1);
  const planCode = formData.get('planCode')?.toString().trim() || undefined;
  const presetValidDaysRaw = formData.get('presetValidDays')?.toString().trim();
  const presetValidDays =
    presetValidDaysRaw && presetValidDaysRaw.length > 0
      ? Number(presetValidDaysRaw)
      : undefined;
  try {
    const out = await dashboardApi<{ keys: string[] }>('/admin/license-keys/generate', {
      method: 'POST',
      body: JSON.stringify({
        count: Number.isFinite(count) ? count : 1,
        planCode,
        presetValidDays: Number.isFinite(presetValidDays) ? presetValidDays : undefined,
      }),
    });
    revalidatePath('/dashboard/admin/licenses');
    return { ok: true, keys: out.keys ?? [] };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Generate failed',
    };
  }
}

export async function revokeLicenseKeyAction(formData: FormData): Promise<void> {
  const id = formData.get('id')?.toString();
  if (!id) throw new Error('Missing id');
  await dashboardApi(`/admin/license-keys/${id}/revoke`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  revalidatePath('/dashboard/admin/licenses');
}
