'use server';

import { revalidatePath } from 'next/cache';
import { dashboardApi } from '@/lib/api-server';

export type RedeemLicenseState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | null;

export async function redeemLicenseKeyAction(
  _prev: RedeemLicenseState | null,
  formData: FormData,
): Promise<RedeemLicenseState> {
  const code = formData.get('code')?.toString().trim() ?? '';
  const guildId = formData.get('guildId')?.toString().trim() ?? '';
  const manageable = formData.get('manageable')?.toString() ?? '';
  if (!code || !guildId) {
    return { ok: false, error: 'Enter a license key and choose a server.' };
  }
  try {
    await dashboardApi(`/me/license-keys/redeem?manageable=${encodeURIComponent(manageable)}`, {
      method: 'POST',
      body: JSON.stringify({ code, guildId }),
    });
    revalidatePath('/dashboard/server-setup');
    revalidatePath('/dashboard/my-servers');
    revalidatePath('/dashboard/members');
    return { ok: true, message: 'License redeemed. Your server entitlement is now active.' };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Redeem failed',
    };
  }
}
