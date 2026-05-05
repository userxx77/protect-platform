'use server';

import { revalidatePath } from 'next/cache';
import { dashboardFormPost } from '@/lib/api-server';

export async function submitEvidenceAction(
  ticketId: string,
  formData: FormData,
): Promise<void> {
  const rawLinks = formData.get('linksText');
  const lines = String(rawLinks ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = new FormData();
  out.append('links', JSON.stringify(lines));
  const files = formData.getAll('images');
  for (const f of files) {
    if (f instanceof File && f.size > 0) {
      out.append('images', f);
    }
  }
  await dashboardFormPost(`/me/tickets/${ticketId}/evidence`, out);
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath('/dashboard/tickets');
}
