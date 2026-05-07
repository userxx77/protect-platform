'use server';

import type { FlagActionLevel } from '@protect/shared';
import { revalidatePath } from 'next/cache';
import { dashboardApi } from '@/lib/api-server';

function revalidateReportPaths(reportId: string) {
  revalidatePath('/dashboard/admin/reports');
  revalidatePath(`/dashboard/reports/${reportId}`);
  revalidatePath('/dashboard');
}

export async function approveReportAction(
  reportId: string,
  severity: FlagActionLevel,
): Promise<void> {
  await dashboardApi(`/reports/${reportId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ severity }),
  });
  revalidateReportPaths(reportId);
}

export async function rejectReportAction(reportId: string): Promise<void> {
  await dashboardApi(`/reports/${reportId}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  revalidateReportPaths(reportId);
}
