'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dashboardApi } from '@/lib/api-server';

export async function saveServerConfig(formData: FormData) {
  const guildId = String(formData.get('guildId') ?? '').trim();
  const alertChannelId = String(formData.get('alertChannelId') ?? '').trim();
  const alertMinLevel = String(formData.get('alertMinLevel') ?? '').trim();

  if (!guildId) {
    redirect('/dashboard/config?error=missing_guild');
  }

  await dashboardApi('/server/config', {
    method: 'POST',
    body: JSON.stringify({
      guildId,
      config: {
        ...(alertChannelId ? { alertChannelId } : {}),
        ...(alertMinLevel ? { alertMinLevel } : {}),
      },
    }),
  });

  revalidatePath('/dashboard/config');
  redirect('/dashboard/config?saved=1');
}
