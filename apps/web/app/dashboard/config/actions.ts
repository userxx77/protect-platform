'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dashboardApi } from '@/lib/api-server';

function parseOptionalBool(raw: string | null | undefined): boolean | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === '' || s === 'unchanged') return undefined;
  if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false;
  return undefined;
}

function parseOptionalInt(raw: string | null | undefined): number | undefined {
  const s = String(raw ?? '').trim();
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export async function saveServerConfig(formData: FormData) {
  const guildId = String(formData.get('guildId') ?? '').trim();
  const alertChannelId = String(formData.get('alertChannelId') ?? '').trim();
  const alertMinLevel = String(formData.get('alertMinLevel') ?? '').trim();
  const joinHoldEnabled = parseOptionalBool(String(formData.get('joinHoldEnabled') ?? ''));
  const joinHoldMinutes = parseOptionalInt(String(formData.get('joinHoldDurationMinutes') ?? ''));
  const joinHoldMinLevel = String(formData.get('joinHoldMinLevel') ?? '').trim();
  const joinActionPolicy = String(formData.get('joinActionPolicy') ?? '').trim();

  if (!guildId) {
    redirect('/dashboard/config?error=missing_guild');
  }

  const config: Record<string, unknown> = {};
  if (alertChannelId) config.alertChannelId = alertChannelId;
  if (alertMinLevel) config.alertMinLevel = alertMinLevel;
  if (joinHoldEnabled !== undefined) config.joinHoldEnabled = joinHoldEnabled;
  if (joinHoldMinutes !== undefined) {
    const clamped = Math.min(40320, Math.max(1, joinHoldMinutes));
    config.joinHoldDurationMinutes = clamped;
  }
  if (joinHoldMinLevel) config.joinHoldMinLevel = joinHoldMinLevel;
  if (joinActionPolicy === 'log' || joinActionPolicy === 'notify' || joinActionPolicy === 'quarantine' || joinActionPolicy === 'kick' || joinActionPolicy === 'ban') {
    config.joinActionPolicy = joinActionPolicy;
  }

  if (Object.keys(config).length === 0) {
    redirect('/dashboard/config?error=no_fields');
  }

  await dashboardApi('/server/config', {
    method: 'POST',
    body: JSON.stringify({
      guildId,
      config,
    }),
  });

  revalidatePath('/dashboard/config');
  redirect('/dashboard/config?saved=1');
}
