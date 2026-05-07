'use server';

import type { FlagActionLevel } from '@protect/shared';
import { revalidatePath } from 'next/cache';
import { dashboardApi } from '@/lib/api-server';

export async function patchTicketAction(ticketId: string, status: string): Promise<void> {
  await dashboardApi(`/admin/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  revalidatePath('/dashboard/admin/tickets');
}

export async function resolveTicketAction(
  ticketId: string,
  severity: FlagActionLevel,
): Promise<void> {
  await dashboardApi(`/admin/tickets/${ticketId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ severity }),
  });
  revalidatePath('/dashboard/admin/tickets');
  revalidatePath('/dashboard/admin/reports');
}
