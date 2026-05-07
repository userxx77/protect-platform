import { auth, signIn } from '@/auth';
import { redirect } from 'next/navigation';

function safeCallbackPath(raw: string | undefined): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/dashboard';
}

export default async function DiscordAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const target = safeCallbackPath(callbackUrl);
  const session = await auth();
  if (session) redirect(target);
  await signIn('discord', { redirectTo: target });
}
