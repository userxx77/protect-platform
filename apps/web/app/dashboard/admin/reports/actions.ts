'use server';

import type { FlagActionLevel } from '@protect/shared';
import { revalidatePath } from 'next/cache';
import { dashboardApi } from '@/lib/api-server';

export async function approveReportAction(
  reportId: string,
  severity: FlagActionLevel,
): Promise<void> {
  await dashboardApi(`/reports/${reportId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ severity }),
  });
  revalidatePath('/dashboard/admin/reports');
}

export async function rejectReportAction(reportId: string): Promise<void> {
  await dashboardApi(`/reports/${reportId}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  revalidatePath('/dashboard/admin/reports');
}
