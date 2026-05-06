import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isPlatformAdminDiscordId } from '@/lib/platform-admin';
import { DashboardShell } from '@/app/dashboard/dashboard-shell';
import { discordSignInPath } from '@/lib/discord-signin';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect(discordSignInPath('/dashboard'));
  }
  const showAdmin = isPlatformAdminDiscordId(session.user?.id);
  const userName = session.user?.name?.trim() || session.user?.id || 'User';
  const manageable = session.manageableGuilds?.length ?? 0;
  const userHint = manageable ? `${manageable} manageable server(s)` : undefined;

  return (
    <DashboardShell showAdmin={showAdmin} userName={userName} userHint={userHint}>
      {children}
    </DashboardShell>
  );
}
