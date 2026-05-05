'use server';

import { revalidatePath } from 'next/cache';
import { dashboardApi } from '@/lib/api-server';

export async function approveReportAction(reportId: string): Promise<void> {
  await dashboardApi(`/reports/${reportId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
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
